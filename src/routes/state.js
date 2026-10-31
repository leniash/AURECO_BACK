const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');

/**
 * Format user from database row to frontend shape
 */
function formatUserForClient(row) {
  const u = {
    id: row.id,
    role: row.role,
    name: row.name,
    schoolId: row.school_id,
    email: row.email,
    phone: row.phone,
    status: row.status,
    year: row.year,
    programme: row.programme,
    overall: row.overall ? parseFloat(row.overall) : null,
    gpas: row.gpas || [],
    bio: row.bio || '',
    skills: row.skills || [],
    linkedin: row.linkedin || '',
    github: row.github || '',
    photo: row.photo || null
  };

  if (row.hon) u.hon = row.hon;
  if (row.title) u.title = row.title;
  if (row.dept) u.dept = row.dept;
  if (row.teaches) u.teaches = row.teaches;
  if (row.company) u.company = row.company;
  if (row.attach) u.attach = row.attach;
  if (row.signup_info) u.signup = row.signup_info;

  return u;
}

/**
 * GET /api/state
 * Returns full application state for the signed-in user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    // 1. Fetch Users
    const usersRes = await query('SELECT * FROM users ORDER BY created_at ASC');
    const users = usersRes.rows.map(formatUserForClient);

    // 2. Fetch Registry
    const regRes = await query('SELECT school_id AS "schoolId", name, email, year, programme FROM registry');
    const registry = regRes.rows;

    // 3. Fetch Portfolio State
    const stateRes = await query('SELECT * FROM portfolio_state WHERE id = $1 LIMIT 1', ['current']);
    let ps = stateRes.rows[0];

    if (!ps) {
      return res.status(500).json({ message: 'Portfolio state is uninitialized.' });
    }

    const state = {
      v: ps.version || 2,
      users,
      registry,
      acts: ps.acts || [],
      projects: ps.projects || [],
      letters: ps.letters || [],
      notes: ps.notes || [],
      finals: ps.finals || {},
      assess: ps.assess || [],
      perms: ps.perms || {},
      permLog: ps.perm_log || [],
      log: ps.audit_log || [],
      reports: ps.reports || []
    };

    return res.json(state);
  } catch (err) {
    console.error('Error fetching state:', err);
    return res.status(500).json({ message: 'Failed to retrieve application state.' });
  }
});

/**
 * PUT /api/state
 * Saves modified application state to Neon PostgreSQL
 */
router.put('/', requireAuth, async (req, res) => {
  try {
    const newState = req.body;
    if (!newState || typeof newState !== 'object') {
      return res.status(400).json({ message: 'Invalid state object.' });
    }

    // 1. Update Portfolio State Row
    await query(`
      UPDATE portfolio_state SET
        projects = $1,
        acts = $2,
        letters = $3,
        notes = $4,
        finals = $5,
        assess = $6,
        perms = $7,
        perm_log = $8,
        audit_log = $9,
        reports = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 'current';
    `, [
      JSON.stringify(newState.projects || []),
      JSON.stringify(newState.acts || []),
      JSON.stringify(newState.letters || []),
      JSON.stringify(newState.notes || []),
      JSON.stringify(newState.finals || {}),
      JSON.stringify(newState.assess || []),
      JSON.stringify(newState.perms || {}),
      JSON.stringify(newState.permLog || []),
      JSON.stringify(newState.log || []),
      JSON.stringify(newState.reports || [])
    ]);

    // 2. Synchronize user profile edits and admin status changes
    if (Array.isArray(newState.users)) {
      for (const u of newState.users) {
        if (!u.id) continue;
        await query(`
          UPDATE users SET
            name = COALESCE($2, name),
            status = COALESCE($3, status),
            bio = COALESCE($4, bio),
            skills = COALESCE($5, skills),
            linkedin = COALESCE($6, linkedin),
            github = COALESCE($7, github),
            photo = COALESCE($8, photo),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, [
          u.id,
          u.name,
          u.status,
          u.bio || '',
          JSON.stringify(u.skills || []),
          u.linkedin || '',
          u.github || '',
          u.photo || null
        ]);
      }
    }

    return res.status(200).json({ success: true, message: 'State saved successfully.' });
  } catch (err) {
    console.error('Error updating state:', err);
    return res.status(500).json({ message: 'Failed to persist application state.' });
  }
});

module.exports = router;
