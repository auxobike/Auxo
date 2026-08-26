const express      = require('express');
const pool          = require('../db');
const requireShop   = require('../middleware/requireShop');
const { findShopByUserId, rowToShop } = require('../utils/shopStore');

const router = express.Router();

// camelCase field name -> DB column, for the fields a shop can edit about itself.
const EDITABLE_FIELDS = {
  name:         'name',
  address:      'address',
  city:         'city',
  state:        'state',
  zip:          'zip',
  phoneFront:   'phone_front',
  phoneService: 'phone_service',
  website:      'website',
  googlePlaceId: 'google_place_id',
  bookingMode:  'booking_mode',
};

// GET /api/shop/profile
router.get('/profile', requireShop, async (req, res) => {
  try {
    const shop = await findShopByUserId(req.session.userId);
    if (!shop) return res.status(404).json({ error: 'Shop not found.' });
    res.json({ shop });
  } catch (err) {
    console.error('[shop] GET profile error:', err.message);
    res.status(500).json({ error: 'Failed to load shop profile.' });
  }
});

// PUT /api/shop/profile
router.put('/profile', requireShop, async (req, res) => {
  if ('bookingMode' in req.body && !['auxo', 'call'].includes(req.body.bookingMode)) {
    return res.status(400).json({ error: "bookingMode must be 'auxo' or 'call'." });
  }

  const setClauses = [];
  const values     = [];
  let   i          = 1;
  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    if (key in req.body) {
      setClauses.push(`${column} = $${i++}`);
      values.push(req.body[key]);
    }
  }
  if (!setClauses.length) {
    return res.status(400).json({ error: 'No fields to update.' });
  }

  try {
    const shop = await findShopByUserId(req.session.userId);
    if (!shop) return res.status(404).json({ error: 'Shop not found.' });

    values.push(shop.id);
    const { rows } = await pool.query(
      `UPDATE shops SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    res.json({ success: true, shop: rowToShop(rows[0]) });
  } catch (err) {
    console.error('[shop] PUT profile error:', err.message);
    res.status(500).json({ error: 'Failed to update shop profile.' });
  }
});

module.exports = router;
