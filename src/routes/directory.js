const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/directory/search?q=...
 * Searches faculty, staff, supervisors, and institutional directory by name or email
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 1) {
      // Return top active staff & supervisors by default
      const staffRes = await query(`
        SELECT id, name, email, role, title, dept, company 
        FROM users 
        WHERE role IN ('staff', 'supervisor') AND status = 'active'
        ORDER BY name ASC 
        LIMIT 20
      `);
      return res.json(staffRes.rows);
    }

    const pattern = `%${q}%`;
    const searchRes = await query(`
      SELECT id, name, email, role, title, dept, company 
      FROM users 
      WHERE role IN ('staff', 'supervisor') 
        AND status = 'active'
        AND (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(COALESCE(dept, '')) LIKE $1)
      ORDER BY name ASC 
      LIMIT 15
    `, [pattern]);

    return res.json(searchRes.rows);
  } catch (err) {
    console.error('Directory search error:', err);
    return res.status(500).json({ message: 'Failed to search directory.' });
  }
});

module.exports = router;
