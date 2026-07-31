const express = require('express');
const pool    = require('../db');

const router       = express.Router();
const VALID_LEVELS = ['featured', 'partner'];

function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/shops/featured  — public
router.get('/shops/featured', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT google_place_id AS "googlePlaceId", name, boost_level AS "boostLevel" FROM featured_shops ORDER BY created_at',
    );
    res.json(rows);
  } catch (err) {
    console.error('[shops] GET featured error:', err.message);
    res.status(500).json({ error: 'Failed to load featured shops' });
  }
});

// GET /api/shops/messaging  — public. Shops registered on Auxo that can
// receive in-app messages, keyed by Google Place ID so the client (Book a
// Service screen, which sources its shop cards from Google Places) can tell
// which cards belong to an actual Auxo shop account.
router.get('/shops/messaging', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, google_place_id AS "googlePlaceId"
       FROM shops
       WHERE google_place_id IS NOT NULL`,
    );
    res.json(rows);
  } catch (err) {
    console.error('[shops] GET messaging error:', err.message);
    res.status(500).json({ error: 'Failed to load messaging-enabled shops' });
  }
});

// GET /api/admin/shops/verify  — validates the admin key without side effects
router.get('/admin/shops/verify', requireAdminKey, (req, res) => {
  res.json({ ok: true });
});

// POST /api/admin/shops/featured  — admin only
// Body: { action?: 'add'|'remove', googlePlaceId, name?, boostLevel? }
router.post('/admin/shops/featured', requireAdminKey, async (req, res) => {
  const { action = 'add', googlePlaceId, name, boostLevel } = req.body;

  if (!googlePlaceId) {
    return res.status(400).json({ error: 'googlePlaceId is required' });
  }

  try {
    if (action === 'remove') {
      await pool.query(
        'DELETE FROM featured_shops WHERE google_place_id = $1',
        [googlePlaceId],
      );
    } else {
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }
      if (!VALID_LEVELS.includes(boostLevel)) {
        return res.status(400).json({ error: `boostLevel must be one of: ${VALID_LEVELS.join(', ')}` });
      }
      await pool.query(
        `INSERT INTO featured_shops (google_place_id, name, boost_level)
         VALUES ($1, $2, $3)
         ON CONFLICT (google_place_id) DO UPDATE SET name = $2, boost_level = $3`,
        [googlePlaceId, name, boostLevel],
      );
    }

    const { rows } = await pool.query(
      'SELECT google_place_id AS "googlePlaceId", name, boost_level AS "boostLevel" FROM featured_shops ORDER BY created_at',
    );
    res.json({ success: true, shops: rows });
  } catch (err) {
    console.error('[shops] POST admin error:', err.message);
    res.status(500).json({ error: 'Failed to update featured shops' });
  }
});

module.exports = router;
