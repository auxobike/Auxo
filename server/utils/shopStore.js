const pool = require('../db');

function rowToShop(row) {
  if (!row) return null;
  return {
    id:            row.id,
    userId:        row.user_id,
    name:          row.name,
    address:       row.address,
    city:          row.city,
    state:         row.state,
    zip:           row.zip,
    phoneFront:    row.phone_front,
    phoneService:  row.phone_service,
    website:       row.website,
    googlePlaceId: row.google_place_id,
    bio:           row.bio,
    isActive:      row.is_active,
    inviteCode:    row.invite_code,
    createdAt:     row.created_at,
  };
}

async function createShop({ userId, name, inviteCode }) {
  const { rows } = await pool.query(
    `INSERT INTO shops (user_id, name, invite_code)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, name, inviteCode],
  );
  return rowToShop(rows[0]);
}

async function findShopByUserId(userId) {
  if (!userId) return null;
  const { rows } = await pool.query(
    'SELECT * FROM shops WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return rowToShop(rows[0]);
}

module.exports = { createShop, findShopByUserId, rowToShop };
