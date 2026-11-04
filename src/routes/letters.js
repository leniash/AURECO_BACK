const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');

/**
 * POST /api/letters/request
 * Dispatches a recommendation letter request and generates guest access code if external
 */
router.post('/request', requireAuth, async (req, res) => {
  try {
    const student = req.user;
    const { recipientEmail, recipientName, staffId, purpose, due, note, share } = req.body;

    if (!recipientEmail || !/^\S+@\S+\.\S+$/.test(recipientEmail)) {
      return res.status(400).json({ message: 'A valid recommender email address is required.' });
    }

    // Check if recipient is an existing registered staff/supervisor user
    const userRes = await query(
      `SELECT id, name, email, role FROM users WHERE LOWER(email) = LOWER($1) AND status = 'active' LIMIT 1`,
      [recipientEmail.trim()]
    );
    const existingStaff = userRes.rows[0];

    const isGuest = !existingStaff;
    const finalStaffId = existingStaff ? existingStaff.id : (staffId || null);
    const finalRecipientName = recipientName || (existingStaff ? existingStaff.name : recipientEmail.split('@')[0]);

    const letterId = 'l_' + Math.random().toString(36).slice(2, 9);
    const accessCode = String(Math.floor(100000 + Math.random() * 900000));
    const token = 'tok_' + crypto.randomBytes(20).toString('hex');

    // 1. Record guest access token in guest_access table (valid for 60 days)
    await query(`
      INSERT INTO guest_access (
        token, access_code, type, reference_id, student_id, recipient_email, recipient_name, expires_at
      ) VALUES ($1, $2, 'letter', $3, $4, $5, $6, NOW() + INTERVAL '60 days')
    `, [
      token,
      accessCode,
      letterId,
      student.id,
      recipientEmail.trim(),
      finalRecipientName
    ]);

    // 2. Add letter to portfolio_state.letters
    const psRes = await query(`SELECT * FROM portfolio_state WHERE id = 'current' LIMIT 1`);
    const ps = psRes.rows[0] || {};
    const letters = ps.letters || [];

    const newLetter = {
      id: letterId,
      sid: student.id,
      staffId: finalStaffId,
      recipientEmail: recipientEmail.trim(),
      recipientName: finalRecipientName,
      purpose: purpose || 'Job application',
      due: due ? new Date(due).getTime() : Date.now() + 14 * 86400000,
      note: (note || '').trim(),
      share: share || { grades: true, ach: true, lead: true, extra: true },
      status: 'waiting',
      reply: '',
      versions: [],
      changeRequests: [],
      changesUsed: 0,
      draft: '',
      accessCode,
      accessToken: token,
      isGuest,
      created: Date.now()
    };

    letters.unshift(newLetter);

    await query(`UPDATE portfolio_state SET letters = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 'current'`, [
      JSON.stringify(letters)
    ]);

    // 3. Dispatch real email notification directly to recommender
    try {
      await emailService.sendLetterRequestNotification({
        to: recipientEmail.trim(),
        recipientName: finalRecipientName,
        studentName: student.name,
        studentProgramme: student.programme,
        purpose: newLetter.purpose,
        note: newLetter.note,
        accessCode,
        token,
        isGuest
      });
    } catch (mailErr) {
      console.error('Failed to dispatch recommendation request email:', mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Recommendation request sent directly to ${recipientEmail}.`,
      letter: newLetter
    });
  } catch (err) {
    console.error('Error creating letter request:', err);
    return res.status(500).json({ message: 'Failed to process recommendation request.' });
  }
});

/**
 * POST /api/letters/verify-activity
 * Dispatches an activity verification request to a designated verifier with access code
 */
router.post('/verify-activity', requireAuth, async (req, res) => {
  try {
    const student = req.user;
    const { activityId, verifierEmail, verifierName } = req.body;

    if (!verifierEmail || !/^\S+@\S+\.\S+$/.test(verifierEmail)) {
      return res.status(400).json({ message: 'A valid verifier email is required.' });
    }

    const psRes = await query(`SELECT * FROM portfolio_state WHERE id = 'current' LIMIT 1`);
    const ps = psRes.rows[0] || {};
    const acts = ps.acts || [];
    const act = acts.find(a => a.id === activityId);
    if (!act) {
      return res.status(404).json({ message: 'Activity not found.' });
    }

    const accessCode = String(Math.floor(100000 + Math.random() * 900000));
    const token = 'tok_' + crypto.randomBytes(20).toString('hex');

    // Record guest access
    await query(`
      INSERT INTO guest_access (
        token, access_code, type, reference_id, student_id, recipient_email, recipient_name, expires_at
      ) VALUES ($1, $2, 'verify', $3, $4, $5, $6, NOW() + INTERVAL '60 days')
    `, [
      token,
      accessCode,
      activityId,
      student.id,
      verifierEmail.trim(),
      verifierName || verifierEmail.split('@')[0]
    ]);

    // Dispatch real email
    try {
      await emailService.sendVerificationRequestNotification({
        to: verifierEmail.trim(),
        verifierName: verifierName || verifierEmail.split('@')[0],
        studentName: student.name,
        activityTitle: act.title,
        activityType: act.type,
        accessCode,
        token,
        isGuest: true
      });
    } catch (mailErr) {
      console.error('Failed to dispatch activity verification email:', mailErr.message);
    }

    return res.json({
      success: true,
      message: `Verification request sent to ${verifierEmail}.`
    });
  } catch (err) {
    console.error('Error dispatching activity verification:', err);
    return res.status(500).json({ message: 'Failed to send verification request.' });
  }
});

module.exports = router;
