const express    = require('express');
const requireAuth = require('../middleware/requireAuth');
const articles   = require('../data/articles.json');

const router = express.Router();

// GET /api/learn/articles
// Returns the full articles list (all fields — client filters what it needs).
router.get('/articles', requireAuth, (req, res) => {
  res.json(articles);
});

// GET /api/learn/articles/:id
router.get('/articles/:id', requireAuth, (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

module.exports = router;
