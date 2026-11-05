const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const aiService = require('../services/aiService');

const guestAuthOrUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return requireAuth(req, res, next);
  }
  const guestToken = req.headers['x-guest-token'] || (req.body && req.body.guestToken);
  if (guestToken) {
    try {
      const check = await query("SELECT * FROM guest_access WHERE token = $1 AND status = 'active' AND expires_at > NOW()", [guestToken]);
      if (check.rows.length > 0) {
        req.guest = check.rows[0];
        return next();
      }
    } catch (e) {
      console.error('Guest auth error in AI route:', e.message);
    }
  }
  return requireAuth(req, res, next);
};

/**
 * POST /api/ai/recommendation-letter
 * Generates an academic recommendation letter with Gemini
 */
router.post('/recommendation-letter', guestAuthOrUser, async (req, res) => {
  try {
    const { student, lecturer, purpose, specificNote, projects, activities, gpa } = req.body;

    if (!student || !student.name) {
      return res.status(400).json({ message: 'Student information is required.' });
    }

    const lecturerInfo = lecturer || req.user || (req.guest ? { name: req.guest.recipient_name, title: 'Recommender', dept: 'External / Partner' } : {});

    const result = await aiService.generateRecommendationLetter({
      student,
      lecturer: lecturerInfo,
      purpose,
      specificNote,
      projects,
      activities,
      gpa
    });

    return res.json(result);
  } catch (err) {
    console.error('AI Letter generation error:', err);
    return res.status(500).json({ message: err.message || 'AI generation failed.' });
  }
});

/**
 * POST /api/ai/portfolio-review
 * Generates a holistic portfolio audit and career recommendation
 */
router.post('/portfolio-review', requireAuth, async (req, res) => {
  try {
    const { student, projects, activities, gpa } = req.body;

    if (!student) {
      return res.status(400).json({ message: 'Student information is required.' });
    }

    const review = await aiService.reviewPortfolio({
      student,
      projects,
      activities,
      gpa
    });

    return res.json(review);
  } catch (err) {
    console.error('AI Portfolio review error:', err);
    return res.status(500).json({ message: err.message || 'AI review failed.' });
  }
});

/**
 * POST /api/ai/improve-project
 * Polishes project bullet points for professional impact
 */
router.post('/improve-project', requireAuth, async (req, res) => {
  try {
    const { name, kind, goal, challenge, role, result } = req.body;

    const polished = await aiService.improveProjectDescription({
      name,
      kind,
      goal,
      challenge,
      role,
      result
    });

    return res.json(polished);
  } catch (err) {
    console.error('AI Project polish error:', err);
    return res.status(500).json({ message: err.message || 'Project improvement failed.' });
  }
});

/**
 * POST /api/ai/draft-request-email
 * Generates an academic recommendation request email from student to recommender
 */
router.post('/draft-request-email', requireAuth, async (req, res) => {
  try {
    const { recipientName, purpose, notes, deadline } = req.body;
    const studentName = req.user ? req.user.name : req.body.studentName;
    const studentProgramme = req.user ? req.user.programme : req.body.studentProgramme;

    const result = await aiService.draftRequestEmail({
      studentName,
      studentProgramme,
      recipientName,
      purpose,
      notes,
      deadline
    });

    const draft = result.emailText || '';
    return res.json({ draft, emailText: draft });
  } catch (err) {
    console.error('AI Request email drafting error:', err);
    return res.status(500).json({ message: err.message || 'AI drafting failed.' });
  }
});

module.exports = router;
