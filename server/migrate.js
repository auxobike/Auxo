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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'rider'
      CHECK (account_type IN ('rider', 'shop'))
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wheelsets (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT        NOT NULL,
      front_miles NUMERIC     NOT NULL DEFAULT 0,
      rear_miles  NUMERIC     NOT NULL DEFAULT 0,
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bike_wheels (
      bike_id           TEXT NOT NULL,
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      front_wheelset_id UUID REFERENCES wheelsets(id) ON DELETE SET NULL,
      rear_wheelset_id  UUID REFERENCES wheelsets(id) ON DELETE SET NULL,
      PRIMARY KEY (bike_id, user_id)
    )
  `);

  // Per-wheelset service logs for wheelTracked maintenance items (sealant, tire replace).
  // Storing here instead of bike_data means the history travels when a wheelset
  // is uninstalled from one bike and installed on another.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wheelset_service_logs (
      wheelset_id UUID NOT NULL REFERENCES wheelsets(id) ON DELETE CASCADE,
      item_id     TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      log         JSONB NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (wheelset_id, item_id)
    )
  `);

  // Tires are tracked independently of wheelsets — a tire is a single physical
  // item (one position, one mileage total), unlike a wheelset which can be
  // installed at either position.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tires (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT        NOT NULL,
      notes      TEXT,
      miles      NUMERIC     NOT NULL DEFAULT 0,
      position   TEXT        NOT NULL CHECK (position IN ('front', 'rear')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bike_tires (
      bike_id       TEXT NOT NULL,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      front_tire_id UUID REFERENCES tires(id) ON DELETE SET NULL,
      rear_tire_id  UUID REFERENCES tires(id) ON DELETE SET NULL,
      PRIMARY KEY (bike_id, user_id)
    )
  `);

  // Per-tire service logs for tireTracked maintenance items (sealant, tire
  // replace) — mirrors wheelset_service_logs so history travels with the tire
  // when it moves between bikes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tire_service_logs (
      tire_id    UUID NOT NULL REFERENCES tires(id) ON DELETE CASCADE,
      item_id    TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      log        JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tire_id, item_id)
    )
  `);

  // Bike shop portal — shops.user_id links a shop back to its login account.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name            TEXT        NOT NULL,
      address         TEXT,
      city            TEXT,
      state           TEXT,
      zip             TEXT,
      phone_front     TEXT,
      phone_service   TEXT,
      website         TEXT,
      google_place_id TEXT,
      bio             TEXT,
      is_active       BOOLEAN     NOT NULL DEFAULT FALSE,
      invite_code     TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Booking mode: whether riders can book through Auxo directly or must call.
  await pool.query(`
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS booking_mode TEXT NOT NULL DEFAULT 'call'
      CHECK (booking_mode IN ('auxo', 'call'))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      rider_id        TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id         UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id       TEXT        NOT NULL,
      sender_type     TEXT        NOT NULL CHECK (sender_type IN ('rider', 'shop')),
      body            TEXT        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at         TIMESTAMPTZ
    )
  `);

  console.log('[migrate] tables ready');
}

module.exports = migrate;
