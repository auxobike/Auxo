const pool = require('./db');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT        PRIMARY KEY,
      email         TEXT        UNIQUE NOT NULL,
      password_hash TEXT        NOT NULL,
      strava_linked BOOLEAN     NOT NULL DEFAULT FALSE,
      strava_id     TEXT,
      strava_tokens JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // One row per Strava gear ID. All mutable bike state (config, service logs,
  // history) lives in the JSONB column so the schema stays stable as new
  // maintenance fields are added.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bike_data (
      bike_id TEXT PRIMARY KEY,
      data    JSONB NOT NULL DEFAULT '{}'
    )
  `);

  // Add preferences column to existing users tables (idempotent)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS featured_shops (
      google_place_id TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      boost_level     TEXT NOT NULL CHECK (boost_level IN ('featured', 'partner')),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log('[migrate] tables ready');
}

module.exports = migrate;
