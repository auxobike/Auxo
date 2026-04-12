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

  // Idempotent column additions
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ride_conditions (
      activity_id     TEXT        NOT NULL,
      user_id         TEXT        NOT NULL,
      gear_id         TEXT,
      condition       TEXT        NOT NULL CHECK (condition IN ('dry', 'wet', 'muddy', 'trainer')),
      is_trainer      BOOLEAN     NOT NULL DEFAULT FALSE,
      actual_miles    NUMERIC     NOT NULL,
      effective_miles NUMERIC     NOT NULL,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (activity_id, user_id)
    )
  `);

  // Idempotent: add is_trainer column if it doesn't exist yet.
  await pool.query(`
    ALTER TABLE ride_conditions ADD COLUMN IF NOT EXISTS is_trainer BOOLEAN NOT NULL DEFAULT FALSE
  `);

  // Idempotent: expand condition CHECK constraint to include 'trainer'.
  // The DO block finds the existing constraint by inspecting its definition
  // and only replaces it when 'trainer' is not already allowed.
  await pool.query(`
    DO $$
    DECLARE
      c_name TEXT;
    BEGIN
      SELECT c.conname INTO c_name
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'ride_conditions' AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%dry%'
        AND pg_get_constraintdef(c.oid) NOT LIKE '%trainer%';
      IF c_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE ride_conditions DROP CONSTRAINT ' || quote_ident(c_name);
        EXECUTE 'ALTER TABLE ride_conditions ADD CONSTRAINT ride_conditions_condition_check '
          || 'CHECK (condition IN (''dry'', ''wet'', ''muddy'', ''trainer''))';
      END IF;
    END $$;
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
