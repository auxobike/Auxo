const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router       = express.Router();
const DATA_FILE    = path.join(__dirname, '../data/featuredShops.json');
const VALID_LEVELS = ['featured', 'partner'];

function readShops() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeShops(shops) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(shops, null, 2));
}

function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/shops/featured  — public
router.get('/shops/featured', (req, res) => {
  res.json(readShops());
});

// POST /api/admin/shops/featured  — admin only
// Body: { action?: 'add'|'remove', googlePlaceId, name?, boostLevel? }
// Omitting action (or action='add') upserts the shop.
router.post('/admin/shops/featured', requireAdminKey, (req, res) => {
  const { action = 'add', googlePlaceId, name, boostLevel } = req.body;

  if (!googlePlaceId) {
    return res.status(400).json({ error: 'googlePlaceId is required' });
  }

  const shops = readShops();

  if (action === 'remove') {
    const updated = shops.filter(s => s.googlePlaceId !== googlePlaceId);
    writeShops(updated);
    return res.json({ success: true, shops: updated });
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!VALID_LEVELS.includes(boostLevel)) {
    return res.status(400).json({ error: `boostLevel must be one of: ${VALID_LEVELS.join(', ')}` });
  }

  const entry    = { googlePlaceId, name, boostLevel };
  const existing = shops.findIndex(s => s.googlePlaceId === googlePlaceId);

  if (existing >= 0) {
    shops[existing] = entry;
  } else {
    shops.push(entry);
  }

  writeShops(shops);
  res.json({ success: true, shops });
});

module.exports = router;
