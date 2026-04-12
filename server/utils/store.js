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

async function deleteBikeData(bikeIds) {
  if (!bikeIds?.length) return;
  await pool.query('DELETE FROM bike_data WHERE bike_id = ANY($1)', [bikeIds]);
}

// Returns the total extra miles (effective - actual) accrued by conditions logged
// for a given user + gear combination. Added to Strava mileage when calculating
// maintenance status so wet/muddy rides count for more wear than their raw distance.
async function getConditionAdjustment(userId, gearId) {
  if (!userId || !gearId) return 0;
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(effective_miles - actual_miles), 0) AS adjustment
     FROM ride_conditions WHERE user_id = $1 AND gear_id = $2`,
    [userId, gearId],
  );
  return parseFloat(rows[0].adjustment) || 0;
}

// Upsert an array of condition records. Duplicate activity+user pairs overwrite
// the previous selection (user changed their mind before saving).
async function saveRideConditions(records) {
  for (const r of records) {
    await pool.query(
      `INSERT INTO ride_conditions
         (activity_id, user_id, gear_id, condition, actual_miles, effective_miles)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (activity_id, user_id) DO UPDATE SET
         condition       = EXCLUDED.condition,
         actual_miles    = EXCLUDED.actual_miles,
         effective_miles = EXCLUDED.effective_miles,
         recorded_at     = NOW()`,
      [r.activityId, r.userId, r.gearId, r.condition, r.actualMiles, r.effectiveMiles],
    );
  }
}

module.exports = {
  getBikeData, setBikeConfig, logService, getServiceHistory,
  getConfiguredBikeIds, deleteBikeData,
  getConditionAdjustment, saveRideConditions,
};
