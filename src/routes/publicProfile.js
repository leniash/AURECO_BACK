const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

/**
 * GET /api/public/profile/:identifier
 * Unauthenticated public profile view honoring student's granular privacy settings
 */
router.get('/profile/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const cleanId = (identifier || '').trim();

    // 1. Fetch Student by share_slug, school_id, or id
    const userRes = await query(
      `SELECT id, name, school_id, email, phone, status, year, programme, overall, gpas, 
              bio, skills, linkedin, github, photo, public_share, share_slug
       FROM users 
       WHERE (share_slug = $1 OR school_id = $1 OR id = $1)
         AND role = 'student' 
         AND status = 'active'
       LIMIT 1`,
      [cleanId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Public portfolio not found or inactive.' });
    }

    const row = userRes.rows[0];
    const settings = row.public_share || { enabled: false };

    // Check if public sharing is enabled by the student
    if (settings.enabled === false) {
      return res.status(403).json({ message: 'This student has not enabled public profile sharing.' });
    }

    // 2. Fetch Portfolio Items from portfolio_state
    const psRes = await query(`SELECT * FROM portfolio_state WHERE id = 'current' LIMIT 1`);
    const ps = psRes.rows[0] || {};

    // 3. Build filtered public profile honoring privacy settings
    const profile = {
      name: row.name,
      schoolId: row.school_id,
      programme: row.programme,
      year: row.year,
      bio: row.bio || '',
      skills: row.skills || [],
      linkedin: row.linkedin || '',
      github: row.github || '',
      photo: row.photo || null,
      shareSlug: row.share_slug || row.school_id,
      institution: 'Africa University, Mutare, Zimbabwe',
      certified: true
    };

    // Overall GPA & Credits
    if (settings.showGrades !== false) {
      profile.overall = row.overall ? parseFloat(row.overall) : null;
      profile.gpas = row.gpas || [];
    } else {
      profile.overall = null;
      profile.gpas = [];
    }

    // Projects
    if (settings.showProjects !== false) {
      const allProjects = ps.projects || [];
      profile.projects = allProjects.filter(p => p.sid === row.id).map(p => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        summary: p.summary,
        goal: p.goal,
        challenge: p.challenge,
        role: p.role,
        result: p.result,
        link: p.link,
        tags: p.tags
      }));
    } else {
      profile.projects = [];
    }

    // Verified Extracurriculars & Leadership
    if (settings.showActs !== false) {
      const allActs = ps.acts || [];
      profile.activities = allActs.filter(a => a.sid === row.id && a.status === 'verified').map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
        year: a.year,
        where: a.where,
        verified: true,
        verifiedBy: a.verifiedBy
      }));
    } else {
      profile.activities = [];
    }

    // Certified Letters of Recommendation
    if (settings.showLetters === true) {
      const allLetters = ps.letters || [];
      profile.letters = allLetters.filter(l => l.sid === row.id && l.status === 'ready').map(l => {
        const last = l.versions && l.versions.length ? l.versions[l.versions.length - 1] : null;
        return {
          id: l.id,
          purpose: l.purpose,
          body: last ? last.body : '',
          signedBy: (last && last.signedBy) || 'Africa University Faculty',
          date: last ? last.sent : l.created
        };
      });
    } else {
      profile.letters = [];
    }

    return res.json({ success: true, profile, settings });
  } catch (err) {
    console.error('Error serving public profile:', err);
    return res.status(500).json({ message: 'Failed to retrieve public portfolio.' });
  }
});

module.exports = router;
