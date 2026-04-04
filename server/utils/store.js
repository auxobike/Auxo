const pool = require('../db');

async function getBikeData(bikeId) {
  const { rows } = await pool.query(
    'SELECT data FROM bike_data WHERE bike_id = $1 LIMIT 1',
    [bikeId],
  );
  return rows[0]?.data ?? null;
}

// Shallow-merge fields into the bike's JSONB data (same semantics as the
// old JSON-file version: new fields win, existing fields are preserved).
async function setBikeConfig(bikeId, config) {
  const { rows } = await pool.query(
    `INSERT INTO bike_data (bike_id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (bike_id) DO UPDATE
       SET data = bike_data.data || $2::jsonb
     RETURNING data`,
    [bikeId, JSON.stringify(config)],
  );
  return rows[0].data;
}

async function logService(bikeId, itemId, entry) {
  const current = await getBikeData(bikeId) ?? {};

  const serviceLogs                = current.serviceLogs    ?? {};
  const serviceHistory             = current.serviceHistory ?? {};
  serviceLogs[itemId]              = { ...(serviceLogs[itemId] ?? {}), ...entry };
  serviceHistory[itemId]           = serviceHistory[itemId] ?? [];
  serviceHistory[itemId].push({ ...entry, loggedAt: new Date().toISOString() });

  const updated = { ...current, serviceLogs, serviceHistory };

  await pool.query(
    `INSERT INTO bike_data (bike_id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (bike_id) DO UPDATE SET data = $2::jsonb`,
    [bikeId, JSON.stringify(updated)],
  );
  return serviceLogs[itemId];
}

async function getServiceHistory(bikeId, itemId) {
  const bike = await getBikeData(bikeId);
  return bike?.serviceHistory?.[itemId] ?? [];
}

async function getConfiguredBikeIds() {
  const { rows } = await pool.query(
    `SELECT bike_id FROM bike_data WHERE data->>'bikeType' IS NOT NULL`,
  );
  return rows.map(r => r.bike_id);
}

module.exports = { getBikeData, setBikeConfig, logService, getServiceHistory, getConfiguredBikeIds };
