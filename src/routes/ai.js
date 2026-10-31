const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const aiService = require('../services/aiService');

/**
 * POST /api/ai/recommendation-letter
 * Generates an academic recommendation letter with Gemini
 */
router.post('/recommendation-letter', requireAuth, async (req, res) => {
  try {
    const { student, lecturer, purpose, specificNote, projects, activities, gpa } = req.body;

    if (!student || !student.name) {
      return res.status(400).json({ message: 'Student information is required.' });
    }

    const result = await aiService.generateRecommendationLetter({
      student,
      lecturer: lecturer || req.user,
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

module.exports = router;
