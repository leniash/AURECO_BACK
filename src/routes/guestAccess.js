const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const emailService = require('../services/emailService');

/**
 * Helper: Retrieve letter and student context for a validated guest token
 */
async function getLetterContext(tokenOrCode, email) {
  let guestRes;
  if (email && tokenOrCode) {
    guestRes = await query(
      `SELECT * FROM guest_access 
       WHERE (token = $1 OR access_code = $1) 
         AND LOWER(recipient_email) = LOWER($2) 
         AND status = 'active' 
         AND expires_at > NOW() 
       LIMIT 1`,
      [tokenOrCode.trim(), email.trim()]
    );
  } else {
    guestRes = await query(
      `SELECT * FROM guest_access 
       WHERE (token = $1 OR access_code = $1) 
         AND status = 'active' 
         AND expires_at > NOW() 
       LIMIT 1`,
      [tokenOrCode.trim()]
    );
  }

  if (guestRes.rows.length === 0) return null;
  const guest = guestRes.rows[0];

  // Retrieve portfolio state
  const psRes = await query(`SELECT * FROM portfolio_state WHERE id = 'current' LIMIT 1`);
  const ps = psRes.rows[0] || {};
  const letters = ps.letters || [];
  const letter = letters.find(l => l.id === guest.reference_id);
  if (!letter) return null;

  // Retrieve student
  const studentRes = await query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [guest.student_id]);
  const sRow = studentRes.rows[0];
  if (!sRow) return null;

  // Filter student data by what student explicitly permitted in letter.share
  const share = letter.share || { grades: true, ach: true, lead: true, extra: true };
  const student = {
    id: sRow.id,
    name: sRow.name,
    schoolId: sRow.school_id,
    programme: sRow.programme,
    year: sRow.year,
    bio: sRow.bio || '',
    skills: sRow.skills || [],
    linkedin: sRow.linkedin || '',
    github: sRow.github || '',
    photo: sRow.photo || null
  };

  if (share.grades) {
    student.overall = sRow.overall ? parseFloat(sRow.overall) : null;
    student.gpas = sRow.gpas || [];
  } else {
    student.overall = null;
    student.gpas = [];
  }

  const allProjects = ps.projects || [];
  const studentProjects = allProjects.filter(p => p.sid === sRow.id);

  const allActs = ps.acts || [];
  const studentActs = allActs.filter(a => a.sid === sRow.id && (
    (a.type === 'achievement' && share.ach) ||
    (a.type === 'leadership' && share.lead) ||
    (a.type === 'extracurricular' && share.extra)
  ));

  return { guest, letter, student, projects: studentProjects, activities: studentActs };
}

/**
 * POST /api/guest/letter/access
 * Authenticates access using token or access code + optional email
 */
router.post('/letter/access', async (req, res) => {
  try {
    const { token, accessCode, email } = req.body;
    const identifier = (token || accessCode || '').trim();
    if (!identifier) {
      return res.status(400).json({ message: 'Token or access code is required.' });
    }

    const ctx = await getLetterContext(identifier, email);
    if (!ctx) {
      return res.status(403).json({ message: 'Invalid, expired, or completed access code. Please verify and try again.' });
    }

    return res.json({
      success: true,
      token: ctx.guest.token,
      guestName: ctx.guest.recipient_name,
      guestEmail: ctx.guest.recipient_email,
      letter: ctx.letter,
      student: ctx.student,
      projects: ctx.projects,
      activities: ctx.activities
    });
  } catch (err) {
    console.error('Guest access verification error:', err);
    return res.status(500).json({ message: 'Failed to authenticate guest access.' });
  }
});

/**
 * GET /api/guest/letter/:token
 * Retrieves letter writing portal context
 */
router.get('/letter/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const ctx = await getLetterContext(token);
    if (!ctx) {
      return res.status(404).json({ message: 'Invalid or expired recommendation request link.' });
    }

    return res.json({
      token: ctx.guest.token,
      guestName: ctx.guest.recipient_name,
      guestEmail: ctx.guest.recipient_email,
      letter: ctx.letter,
      student: ctx.student,
      projects: ctx.projects,
      activities: ctx.activities
    });
  } catch (err) {
    console.error('Error fetching guest letter context:', err);
    return res.status(500).json({ message: 'Failed to retrieve recommendation request.' });
  }
});

/**
 * POST /api/guest/letter/:token/submit
 * Submits, declines, or saves draft of recommendation letter
 */
router.post('/letter/:token/submit', async (req, res) => {
  try {
    const { token } = req.params;
    const { body, action, reply, signedBy } = req.body;

    const ctx = await getLetterContext(token);
    if (!ctx) {
      return res.status(404).json({ message: 'Invalid or expired recommendation request link.' });
    }

    const psRes = await query(`SELECT * FROM portfolio_state WHERE id = 'current' LIMIT 1`);
    const ps = psRes.rows[0] || {};
    const letters = ps.letters || [];
    const idx = letters.findIndex(l => l.id === ctx.letter.id);
    if (idx === -1) {
      return res.status(404).json({ message: 'Letter request not found.' });
    }

    const letter = letters[idx];
    const signer = signedBy || ctx.guest.recipient_name;

    if (action === 'draft') {
      letter.draft = body || '';
    } else if (action === 'decline') {
      letter.status = 'declined';
      letter.reply = reply || 'Recommender was unable to fulfill request at this time.';
      await query(`UPDATE guest_access SET status = 'completed' WHERE token = $1`, [token]);
    } else {
      // Final Submit / Sign
      if (!body || !body.trim()) {
        return res.status(400).json({ message: 'Letter content cannot be empty.' });
      }
      const n = (letter.versions || []).length + 1;
      letter.versions = letter.versions || [];
      letter.versions.push({
        n,
        body: body.trim(),
        sent: Date.now(),
        seen: false,
        signedBy: signer
      });
      letter.status = 'ready';
      letter.draft = '';

      // Mark token completed
      await query(`UPDATE guest_access SET status = 'completed' WHERE token = $1`, [token]);

      // Notify student via email
      try {
        const sRes = await query(`SELECT email, name FROM users WHERE id = $1`, [letter.sid]);
        if (sRes.rows.length > 0) {
          const s = sRes.rows[0];
          await emailService.sendLetterReadyNotification(s.email, s.name, signer);
        }
      } catch (e) {
        console.error('Failed to dispatch letter ready email:', e.message);
      }
    }

    letters[idx] = letter;

    // Persist to portfolio_state
    await query(`UPDATE portfolio_state SET letters = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 'current'`, [
      JSON.stringify(letters)
    ]);

    return res.json({
      success: true,
      message: action === 'draft' ? 'Draft saved.' : action === 'decline' ? 'Request declined.' : 'Letter submitted and certified successfully.',
      letter
    });
  } catch (err) {
    console.error('Guest letter submission error:', err);
    return res.status(500).json({ message: 'Failed to process letter action.' });
  }
});

/**
 * GET /api/guest/verify/:token
 * Retrieves activity details for guest verification
 */
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const guestRes = await query(
      `SELECT * FROM guest_access WHERE token = $1 AND type = 'verify' AND status = 'active' AND expires_at > NOW() LIMIT 1`,
      [token]
    );
    if (guestRes.rows.length === 0) {
      return res.status(404).json({ message: 'Invalid or expired verification link.' });
    }
    const guest = guestRes.rows[0];

    const psRes = await query(`SELECT * FROM portfolio_state WHERE id = 'current' LIMIT 1`);
    const ps = psRes.rows[0] || {};
    const acts = ps.acts || [];
    const act = acts.find(a => a.id === guest.reference_id);
    if (!act) return res.status(404).json({ message: 'Activity entry not found.' });

    const studentRes = await query(`SELECT name, school_id, programme, year FROM users WHERE id = $1`, [guest.student_id]);
    const student = studentRes.rows[0] || {};

    return res.json({
      token: guest.token,
      verifierName: guest.recipient_name,
      verifierEmail: guest.recipient_email,
      student,
      activity: act
    });
  } catch (err) {
    console.error('Error fetching guest verification context:', err);
    return res.status(500).json({ message: 'Failed to load verification entry.' });
  }
});

/**
 * POST /api/guest/verify/:token
 * Submits verification decision (verify or ask for evidence)
 */
router.post('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { status, comment, verifiedBy } = req.body; // status: 'verified' | 'evidence'

    const guestRes = await query(
      `SELECT * FROM guest_access WHERE token = $1 AND type = 'verify' AND status = 'active' AND expires_at > NOW() LIMIT 1`,
      [token]
    );
    if (guestRes.rows.length === 0) {
      return res.status(404).json({ message: 'Invalid or expired verification link.' });
    }
    const guest = guestRes.rows[0];

    const psRes = await query(`SELECT * FROM portfolio_state WHERE id = 'current' LIMIT 1`);
    const ps = psRes.rows[0] || {};
    const acts = ps.acts || [];
    const idx = acts.findIndex(a => a.id === guest.reference_id);
    if (idx === -1) return res.status(404).json({ message: 'Activity entry not found.' });

    const act = acts[idx];
    act.status = status === 'verified' ? 'verified' : 'evidence';
    act.verifiedBy = verifiedBy || guest.recipient_name;
    act.verifiedAt = Date.now();
    if (comment) {
      act.comments = act.comments || [];
      act.comments.push({ by: verifiedBy || guest.recipient_name, text: comment, at: Date.now() });
    }

    acts[idx] = act;
    await query(`UPDATE portfolio_state SET acts = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 'current'`, [
      JSON.stringify(acts)
    ]);

    await query(`UPDATE guest_access SET status = 'completed' WHERE token = $1`, [token]);

    return res.json({ success: true, message: `Activity status updated to ${act.status}.`, activity: act });
  } catch (err) {
    console.error('Guest verification submission error:', err);
    return res.status(500).json({ message: 'Failed to submit verification.' });
  }
});

module.exports = router;
