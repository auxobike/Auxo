const pool   = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

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
    preferences:  row.preferences ?? {},
    createdAt:    row.created_at,
    lastLoginAt:  row.last_login_at ?? null,
    accountType:  row.account_type,
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

async function createUser({ email, passwordHash, accountType = 'rider' }) {
  const id = crypto.randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, password_hash, account_type)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, email.toLowerCase().trim(), passwordHash, accountType],
  );
  return rowToUser(rows[0]);
}

async function findByStravaId(stravaId) {
  if (!stravaId) return null;
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE strava_id = $1 LIMIT 1',
    [stravaId],
  );
  return rowToUser(rows[0]);
}

// Creates a user row for a Strava-only login (no email/password set) so
// lastLoginAt can be tracked across sessions the same way as email/password
// accounts. email/password_hash are placeholders — this account can never
// log in via POST /auth/login since the password hash is a random value the
// user never sees.
async function createStravaUser({ stravaId, stravaTokens }) {
  const id           = crypto.randomUUID();
  const email        = `strava-${stravaId}@no-login.auxo`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), SALT_ROUNDS);

  const { rows } = await pool.query(
    `INSERT INTO users (id, email, password_hash, strava_linked, strava_id, strava_tokens)
     VALUES ($1, $2, $3, TRUE, $4, $5)
     RETURNING *`,
    [id, email, passwordHash, stravaId, stravaTokens],
  );
  return rowToUser(rows[0]);
}

async function updateUser(id, fields) {
  const setClauses = [];
  const values     = [];
  let   i          = 1;

  if ('stravaLinked'  in fields) { setClauses.push(`strava_linked  = $${i++}`); values.push(fields.stravaLinked); }
  if ('stravaId'      in fields) { setClauses.push(`strava_id     = $${i++}`); values.push(fields.stravaId); }
  if ('stravaTokens'  in fields) { setClauses.push(`strava_tokens = $${i++}`); values.push(fields.stravaTokens); }
  if ('passwordHash'  in fields) { setClauses.push(`password_hash = $${i++}`); values.push(fields.passwordHash); }
  if ('preferences'   in fields) { setClauses.push(`preferences   = $${i++}`); values.push(JSON.stringify(fields.preferences)); }
  if ('lastLoginAt'   in fields) { setClauses.push(`last_login_at = $${i++}`); values.push(fields.lastLoginAt); }

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

async function deleteUser(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

module.exports = { findByEmail, findById, findByStravaId, createUser, createStravaUser, updateUser, deleteUser, publicUser };
