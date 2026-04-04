const pool = require('../db');

// Map a DB row (snake_case) to the JS object shape the rest of the app expects.
function rowToUser(row) {
  if (!row) return null;
  return {
    id:           row.id,
    email:        row.email,
    passwordHash: row.password_hash,
    stravaLinked: row.strava_linked,
    stravaId:     row.strava_id,
    stravaTokens: row.strava_tokens,   // already parsed by pg (JSONB column)
    createdAt:    row.created_at,
  };
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  return rowToUser(rows[0]);
}

async function findById(id) {
  if (!id) return null;
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id],
  );
  return rowToUser(rows[0]);
}

async function createUser({ email, passwordHash }) {
  const id = crypto.randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, email.toLowerCase().trim(), passwordHash],
  );
  return rowToUser(rows[0]);
}

async function updateUser(id, fields) {
  const setClauses = [];
  const values     = [];
  let   i          = 1;

  if ('stravaLinked' in fields) { setClauses.push(`strava_linked = $${i++}`); values.push(fields.stravaLinked); }
  if ('stravaId'     in fields) { setClauses.push(`strava_id     = $${i++}`); values.push(fields.stravaId); }
  if ('stravaTokens' in fields) { setClauses.push(`strava_tokens = $${i++}`); values.push(fields.stravaTokens); }

  if (!setClauses.length) return findById(id);

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values,
  );
  return rowToUser(rows[0]);
}

// Return a user object safe to expose to the client (no passwordHash).
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...pub } = user;
  return pub;
}

module.exports = { findByEmail, findById, createUser, updateUser, publicUser };
