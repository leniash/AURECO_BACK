const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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
  if (row.must_change_password) u.mustChangePassword = true;

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
    const regRes = await query('SELECT school_id AS "schoolId", name, email, year, programme, overall, gpas FROM registry');
    const registry = regRes.rows.map(r => ({
      schoolId: r.schoolId,
      name: r.name,
      email: r.email,
      year: r.year,
      programme: r.programme,
      overall: r.overall != null ? parseFloat(r.overall) : null,
      gpas: Array.isArray(r.gpas) ? r.gpas : (typeof r.gpas === 'string' ? JSON.parse(r.gpas) : [])
    }));

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

    // 2. Synchronize user profile edits, admin status changes, and newly created staff/supervisors
    if (Array.isArray(newState.users)) {
      for (const u of newState.users) {
        if (!u.id) continue;

        const cleanEmail = (u.email || '').trim().toLowerCase();
        const existing = await query(
          'SELECT id FROM users WHERE id = $1 OR (email IS NOT NULL AND LOWER(email) = $2) LIMIT 1',
          [u.id, cleanEmail]
        );

        if (existing.rows.length > 0) {
          const uOverall = u.overall !== undefined && u.overall !== null ? parseFloat(u.overall) : null;
          const uGpas = Array.isArray(u.gpas) ? JSON.stringify(u.gpas) : null;
          await query(`
            UPDATE users SET
              name = COALESCE($2, name),
              status = COALESCE($3, status),
              bio = COALESCE($4, bio),
              skills = COALESCE($5, skills),
              linkedin = COALESCE($6, linkedin),
              github = COALESCE($7, github),
              photo = COALESCE($8, photo),
              teaches = COALESCE($9, teaches),
              dept = COALESCE($10, dept),
              title = COALESCE($11, title),
              hon = COALESCE($12, hon),
              company = COALESCE($13, company),
              attach = COALESCE($14, attach),
              year = CASE WHEN $15::int IS NOT NULL THEN $15::int ELSE year END,
              programme = CASE WHEN $16::text IS NOT NULL AND $16::text <> '' THEN $16::text ELSE programme END,
              overall = CASE WHEN $17::numeric IS NOT NULL THEN $17::numeric ELSE overall END,
              gpas = CASE WHEN $18::jsonb IS NOT NULL AND $18::text <> 'null' THEN $18::jsonb ELSE gpas END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1;
          `, [
            existing.rows[0].id,
            u.name,
            u.status,
            u.bio !== undefined ? u.bio : '',
            JSON.stringify(u.skills || []),
            u.linkedin !== undefined ? u.linkedin : '',
            u.github !== undefined ? u.github : '',
            u.photo !== undefined ? u.photo : null,
            JSON.stringify(u.teaches || []),
            u.dept || null,
            u.title || null,
            u.hon || null,
            u.company || null,
            u.attach ? JSON.stringify(u.attach) : null,
            u.year || null,
            u.programme || null,
            uOverall,
            uGpas
          ]);
        } else {
          // New user (e.g. staff or supervisor added by administrator)
          const rawPassword = u.password || 'demo1234';
          const passwordHash = await bcrypt.hash(rawPassword, 10);
          await query(`
            INSERT INTO users (
              id, role, name, school_id, email, password_hash, phone, status,
              year, programme, overall, gpas, bio, skills, linkedin, github, photo,
              hon, title, dept, teaches, company, attach, signup_info, must_change_password
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $12, $13, $14, $15, $16, $17,
              $18, $19, $20, $21, $22, $23, $24, $25
            )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              email = EXCLUDED.email,
              status = EXCLUDED.status,
              dept = EXCLUDED.dept,
              title = EXCLUDED.title,
              hon = EXCLUDED.hon,
              teaches = EXCLUDED.teaches,
              company = EXCLUDED.company,
              attach = EXCLUDED.attach,
              year = EXCLUDED.year,
              programme = EXCLUDED.programme,
              overall = EXCLUDED.overall,
              gpas = EXCLUDED.gpas,
              updated_at = CURRENT_TIMESTAMP;
          `, [
            u.id,
            u.role || 'staff',
            u.name,
            u.schoolId || null,
            cleanEmail,
            passwordHash,
            u.phone || null,
            u.status || 'active',
            u.year || null,
            u.programme || null,
            u.overall || null,
            JSON.stringify(u.gpas || []),
            u.bio || '',
            JSON.stringify(u.skills || []),
            u.linkedin || '',
            u.github || '',
            u.photo || null,
            u.hon || null,
            u.title || null,
            u.dept || null,
            JSON.stringify(u.teaches || []),
            u.company || null,
            u.attach ? JSON.stringify(u.attach) : null,
            u.signup ? JSON.stringify(u.signup) : null,
            true // must_change_password is true for default password
          ]);
        }
      }
    }

    // 3. Synchronize registry table when administrator imports students
    if (Array.isArray(newState.registry) && newState.registry.length > 0) {
      for (const r of newState.registry) {
        if (!r.schoolId || !r.name || !r.email) continue;
        const regOverall = (r.overall !== undefined && r.overall !== null) ? parseFloat(r.overall) : null;
        const regGpas = Array.isArray(r.gpas) ? JSON.stringify(r.gpas) : '[]';

        await query(`
          INSERT INTO registry (school_id, name, email, year, programme, overall, gpas)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (school_id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            year = EXCLUDED.year,
            programme = EXCLUDED.programme,
            overall = COALESCE(EXCLUDED.overall, registry.overall),
            gpas = CASE WHEN EXCLUDED.gpas::text <> '[]'::text THEN EXCLUDED.gpas ELSE registry.gpas END;
        `, [r.schoolId, r.name, r.email, r.year || 1, r.programme || '', regOverall, regGpas]);

        // CRITICAL: Immediately update matching active student in users table with uploaded results!
        if (regOverall !== null || (Array.isArray(r.gpas) && r.gpas.length > 0)) {
          await query(`
            UPDATE users SET
              overall = COALESCE($2, overall),
              gpas = CASE WHEN $3::jsonb <> '[]'::jsonb THEN $3::jsonb ELSE gpas END,
              year = COALESCE($4, year),
              programme = COALESCE($5, programme),
              updated_at = CURRENT_TIMESTAMP
            WHERE school_id = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($6));
          `, [r.schoolId, regOverall, regGpas, r.year || null, r.programme || null, r.email]);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'State saved successfully.' });
  } catch (err) {
    console.error('Error updating state:', err);
    return res.status(500).json({ message: 'Failed to persist application state.' });
  }
});

module.exports = router;
