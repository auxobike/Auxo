const pool = require('../db');
const { setBikeConfig } = require('./store');

// Recompute effectiveMileageAdj (weather-condition extra miles) and trainerMilesTotal
// for a single bike from the ride_conditions table, then persist both to bike_data JSONB.
// Called after a user saves conditions and at login so the stored values stay in sync.
async function recalculateEffectiveMileage(bikeId, userId) {
  if (!bikeId || !userId) return { effectiveMileageAdj: 0, trainerMilesTotal: 0 };

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN NOT is_trainer THEN effective_miles - actual_miles ELSE 0 END), 0) AS adj,
       COALESCE(SUM(CASE WHEN     is_trainer THEN actual_miles                   ELSE 0 END), 0) AS trainer_miles
     FROM ride_conditions WHERE user_id = $1 AND gear_id = $2`,
    [userId, bikeId],
  );

  const effectiveMileageAdj = parseFloat(rows[0].adj)           || 0;
  const trainerMilesTotal   = parseFloat(rows[0].trainer_miles) || 0;
  await setBikeConfig(bikeId, { effectiveMileageAdj, trainerMilesTotal });
  return { effectiveMileageAdj, trainerMilesTotal };
}

// Recalculate for all bikes belonging to a user (e.g. on login).
// Errors per-bike are caught and logged so one failure doesn't block the others.
async function syncEffectiveMileageForUser(bikeIds, userId) {
  if (!bikeIds?.length || !userId) return;

  await Promise.all(bikeIds.map(async bikeId => {
    try {
      await recalculateEffectiveMileage(bikeId, userId);
    } catch (err) {
      console.error('[syncEffectiveMileage] bikeId=%s error:', bikeId, err.message);
    }
  }));
}

module.exports = { recalculateEffectiveMileage, syncEffectiveMileageForUser };
