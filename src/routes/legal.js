const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const LEGAL_DIR = path.join(__dirname, '..', '..', 'legal');

const documents = {
  privacy: { title: 'Privacy Policy', file: 'PRIVACY_POLICY.md' },
  cookies: { title: 'Cookie Notice', file: 'COOKIE_NOTICE.md' },
};

// GET /api/legal            -> list available documents
router.get('/', (req, res) => {
  res.json(
    Object.entries(documents).map(([slug, d]) => ({
      slug,
      title: d.title,
      url: `/api/legal/${slug}`,
    }))
  );
});

// GET /api/legal/:slug      -> { slug, title, content } (Markdown)
// GET /api/legal/:slug?format=text -> raw Markdown
router.get('/:slug', (req, res) => {
  const doc = documents[req.params.slug];
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  fs.readFile(path.join(LEGAL_DIR, doc.file), 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Unable to load document' });
    res.set('Cache-Control', 'public, max-age=3600');
    if (req.query.format === 'text') {
      return res.type('text/markdown').send(content);
    }
    res.json({ slug: req.params.slug, title: doc.title, content });
  });
});

module.exports = router;
