const express = require('express');
const axios = require('axios');
const requireAuth = require('../middleware/requireAuth');
const { getBikeData, saveRideConditions, getRideConditions, deleteRideCondition } = require('../utils/store');
const { findById } = require('../utils/userStore');
const { recalculateEffectiveMileage } = require('../utils/effectiveMileage');
const pool = require('../db');

const router = express.Router();

// Helper: make authenticated Strava API request
function stravaGet(path, token, params = {}) {
  return axios.get(`https://www.strava.com/api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
}

// GET /api/strava/activities — list recent activities
router.get('/activities', requireAuth, async (req, res) => {
  try {
    const { page = 1, per_page = 30 } = req.query;
    const response = await stravaGet('/athlete/activities', req.session.access_token, {
      page,
      per_page,
    });
    res.json(response.data);
  } catch (err) {
    console.error('Strava activities error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// GET /api/strava/activities/:id — single activity detail
router.get('/activities/:id', requireAuth, async (req, res) => {
  try {
    const response = await stravaGet(
      `/activities/${req.params.id}`,
      req.session.access_token
    );
    res.json(response.data);
  } catch (err) {
    console.error('Strava activity error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/strava/bikes — list athlete's bikes (gear)
// Uses the bike list stored in the DB at OAuth time to avoid a live Strava call.
// Falls back to a fresh GET /athlete request only when cached data is absent.
router.get('/bikes', requireAuth, async (req, res) => {
  const token = req.session.access_token;

  try {
    // Prefer the bike list already stored in DB — avoids a live Strava round-trip.
    if (req.session.userId) {
      const user = await findById(req.session.userId);
      const cachedBikes = user?.stravaTokens?.athlete?.bikes;
      if (Array.isArray(cachedBikes) && cachedBikes.length > 0) {
        return res.json(cachedBikes);
      }
    }

    // Cache miss — fall back to a live Strava request.
    const athleteRes = await stravaGet('/athlete', token);
    const bikes = athleteRes.data.bikes || [];
    res.json(bikes);
  } catch (err) {
    console.error('[/api/strava/bikes] error status:', err.response?.status);
    console.error('[/api/strava/bikes] message:', err.message);
    res.status(500).json({ error: 'Failed to fetch bikes' });
  }
});

// GET /api/strava/bikes/:id — single bike/gear detail
router.get('/bikes/:id', requireAuth, async (req, res) => {
  try {
    const response = await stravaGet(
      `/gear/${req.params.id}`,
      req.session.access_token
    );
    res.json(response.data);
  } catch (err) {
    console.error('Strava gear error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch bike details' });
  }
});

// GET /api/strava/new-rides
// Returns rides recorded since the user's previous login (stored in session as
// lastLoginAt). Falls back to the past 7 days when no prior login is recorded.
// Each ride is enriched with distanceMiles, bikeName, and bikeType from our DB.
router.get('/new-rides', requireAuth, async (req, res) => {
  const token = req.session.access_token;
  if (!token) return res.json([]);

  const lastLoginAt = req.session.lastLoginAt;
  const after = lastLoginAt
    ? Math.floor(new Date(lastLoginAt).getTime() / 1000)
    : Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

  try {
    // Fetch activities and cached bike names in parallel.
    // The DB lookup avoids a live GET /athlete Strava call for users who have
    // previously linked — only falls back to Strava when cache is missing.
    const [actRes, userRecord] = await Promise.all([
      stravaGet('/athlete/activities', token, { after, per_page: 50 }),
      req.session.userId ? findById(req.session.userId) : Promise.resolve(null),
    ]);

    console.log(`[new-rides] lastLoginAt=${lastLoginAt} after=${after} activitiesReturned=${actRes.data.length}`);

    const RIDE_TYPES = new Set(['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide']);
    // Strava returns activities newest-first; take the 5 most recent ride types.
    const activities = actRes.data
      .filter(a => RIDE_TYPES.has(a.sport_type))
      .slice(0, 5);

    // Build bike name map — prefer cached DB data, fall back to live Strava call.
    const bikeNameMap = {};
    const cachedBikes = userRecord?.stravaTokens?.athlete?.bikes;
    if (Array.isArray(cachedBikes) && cachedBikes.length > 0) {
      for (const bike of cachedBikes) bikeNameMap[bike.id] = bike.name;
    } else {
      const athleteRes = await stravaGet('/athlete', token);
      for (const bike of (athleteRes.data.bikes || [])) bikeNameMap[bike.id] = bike.name;
    }

    // Look up configured bikeType for each unique gear from our DB
    const uniqueGearIds = [...new Set(activities.map(a => a.gear_id).filter(Boolean))];
    const bikeTypeMap = {};
    await Promise.all(uniqueGearIds.map(async gearId => {
      try {
        const data = await getBikeData(gearId);
        bikeTypeMap[gearId] = data?.bikeType || null;
      } catch {
        bikeTypeMap[gearId] = null;
      }
    }));

    const rides = activities.map(a => ({
      id:            String(a.id),
      name:          a.name,
      distanceMiles: Math.round(((a.distance || 0) / 1609.34) * 10) / 10,
      date:          a.start_date_local?.split('T')[0] || null,
      gearId:        a.gear_id || null,
      bikeName:      a.gear_id ? (bikeNameMap[a.gear_id] || 'Unknown bike') : null,
      bikeType:      a.gear_id ? (bikeTypeMap[a.gear_id] || null) : null,
      isTrainer:     a.sport_type === 'VirtualRide' || a.trainer === true,
    }));

    res.json(rides);
  } catch (err) {
    console.error('[new-rides] error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch new rides' });
  }
});

// GET /api/strava/rides/:bikeId — last 5 rides on a specific bike with their stored conditions.
// Used by BikeInspector to show a Recent Rides section with per-ride edit capability.
router.get('/rides/:bikeId', requireAuth, async (req, res) => {
  const { bikeId } = req.params;
  const token  = req.session.access_token;
  const userId = req.session.userId;

  if (!token) return res.json([]);

  try {
    const [actRes, userRecord] = await Promise.all([
      stravaGet('/athlete/activities', token, { per_page: 50 }),
      userId ? findById(userId) : Promise.resolve(null),
    ]);

    const RIDE_TYPES = new Set(['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide']);
    const bikeActivities = actRes.data
      .filter(a => a.gear_id === bikeId && RIDE_TYPES.has(a.sport_type))
      .slice(0, 5);

    const activityIds  = bikeActivities.map(a => String(a.id));
    const conditionsMap = await getRideConditions(userId, activityIds);

    const bikeNameMap = {};
    for (const bike of (userRecord?.stravaTokens?.athlete?.bikes || [])) {
      bikeNameMap[bike.id] = bike.name;
    }

    const rides = bikeActivities.map(a => {
      const cond  = conditionsMap[String(a.id)] || null;
      const stravaIsTrainer = a.sport_type === 'VirtualRide' || a.trainer === true;
      return {
        id:            String(a.id),
        name:          a.name,
        distanceMiles: Math.round(((a.distance || 0) / 1609.34) * 10) / 10,
        date:          a.start_date_local?.split('T')[0] || null,
        stravaGearId:  a.gear_id || null,
        gearId:        cond?.gearId || a.gear_id || null,
        bikeName:      bikeNameMap[a.gear_id] || null,
        isTrainer:     cond ? cond.isTrainer : stravaIsTrainer,
        condition:     cond && !cond.isTrainer ? cond.condition : null,
        hasCondition:  !!cond,
      };
    });

    res.json(rides);
  } catch (err) {
    console.error('[strava/rides] error:', err.message);
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
});

// PUT /api/strava/ride-conditions/:activityId — edit an existing condition record.
// Handles bike reassignment (recalculates both old and new gear), condition change,
// and trainer↔outdoor switching.
router.put('/ride-conditions/:activityId', requireAuth, async (req, res) => {
  const { activityId } = req.params;
  const { condition, isTrainer, gearId, distanceMiles } = req.body;
  const userId = req.session.userId;

  const MULTIPLIERS = { dry: 1.0, wet: 1.3, muddy: 1.5 };
  if (!isTrainer && condition && MULTIPLIERS[condition] === undefined) {
    return res.status(400).json({ error: 'Invalid condition' });
  }

  // Read current record so we can recalculate the old gear after a reassignment.
  const existing = await getRideConditions(userId, [activityId]);
  const oldGearId = existing[activityId]?.gearId || null;
  const actualMiles = Number(distanceMiles) || existing[activityId]?.actualMiles || 0;

  const record = {
    activityId:     String(activityId),
    userId,
    gearId:         gearId || null,
    condition:      isTrainer ? 'trainer' : (condition || 'dry'),
    isTrainer:      !!isTrainer,
    actualMiles,
    effectiveMiles: isTrainer ? actualMiles : actualMiles * (MULTIPLIERS[condition] || 1.0),
  };

  await saveRideConditions([record]);

  const gearsToUpdate = [...new Set([oldGearId, gearId].filter(Boolean))];
  if (gearsToUpdate.length > 0 && userId) {
    Promise.all(gearsToUpdate.map(g => recalculateEffectiveMileage(g, userId)))
      .catch(err => console.error('[ride-conditions PUT] sync error:', err.message));
  }

  res.json({ success: true });
});

// DELETE /api/strava/ride-conditions/:activityId — remove a condition record so the
// ride is treated as untagged. Recalculates effectiveMileage for the affected gear.
router.delete('/ride-conditions/:activityId', requireAuth, async (req, res) => {
  const { activityId } = req.params;
  const userId = req.session.userId;

  const oldGearId = await deleteRideCondition(userId, activityId);

  if (oldGearId && userId) {
    recalculateEffectiveMileage(oldGearId, userId)
      .catch(err => console.error('[ride-conditions DELETE] sync error:', err.message));
  }

  res.json({ success: true });
});

// POST /api/strava/ride-conditions
// Save condition selections for one or more rides. Computes effective_miles
// server-side so the multiplier logic stays authoritative on the backend.
router.post('/ride-conditions', requireAuth, async (req, res) => {
  const { conditions } = req.body;

  if (!Array.isArray(conditions) || conditions.length === 0) {
    return res.status(400).json({ error: 'conditions array is required' });
  }

  const MULTIPLIERS = { dry: 1.0, wet: 1.3, muddy: 1.5 };
  const userId = req.session.userId;

  const records = conditions
    .filter(c => c.isTrainer || (c.condition && MULTIPLIERS[c.condition] !== undefined))
    .map(c => {
      const actualMiles = Number(c.distanceMiles) || 0;
      return {
        activityId:     String(c.activityId),
        userId,
        gearId:         c.gearId || null,
        // Trainer rides use condition='trainer'; per-category wear is applied in
        // the maintenance calculator using trainerMilesTotal — not via effective_miles.
        condition:      c.isTrainer ? 'trainer' : c.condition,
        isTrainer:      !!c.isTrainer,
        actualMiles,
        effectiveMiles: c.isTrainer ? actualMiles : actualMiles * MULTIPLIERS[c.condition],
      };
    });

  try {
    await saveRideConditions(records);

    // Fire-and-forget: update stored effective mileage for each affected bike.
    const uniqueGearIds = [...new Set(records.map(r => r.gearId).filter(Boolean))];
    if (uniqueGearIds.length > 0 && userId) {
      Promise.all(uniqueGearIds.map(gId => recalculateEffectiveMileage(gId, userId)))
        .catch(err => console.error('[ride-conditions] effectiveMileage sync error:', err.message));
    }

    // Fire-and-forget: add miles to installed wheelsets.
    if (userId) {
      const addWheelsetMiles = async () => {
        console.log(`[wheelset-miles] starting, userId=${userId}, records=${records.length}`);
        for (const record of records) {
          if (!record.gearId) {
            console.log(`[wheelset-miles] skip activity=${record.activityId} — no gearId`);
            continue;
          }
          try {
            const { rows } = await pool.query(
              'SELECT front_wheelset_id, rear_wheelset_id FROM bike_wheels WHERE bike_id = $1 AND user_id = $2',
              [record.gearId, userId]
            );
            if (rows.length === 0) {
              console.log(`[wheelset-miles] skip activity=${record.activityId} gearId=${record.gearId} userId=${userId} — no bike_wheels row found`);
              continue;
            }
            const { front_wheelset_id, rear_wheelset_id } = rows[0];
            const miles = record.isTrainer ? 0 : record.actualMiles;
            console.log(`[wheelset-miles] activity=${record.activityId} gearId=${record.gearId} miles=${miles} front=${front_wheelset_id || 'none'} rear=${rear_wheelset_id || 'none'}`);

            if (front_wheelset_id) {
              await pool.query(
                'UPDATE wheelsets SET front_miles = front_miles + $1 WHERE id = $2 AND user_id = $3',
                [miles, front_wheelset_id, userId]
              );
            }
            if (rear_wheelset_id) {
              await pool.query(
                'UPDATE wheelsets SET rear_miles = rear_miles + $1 WHERE id = $2 AND user_id = $3',
                [miles, rear_wheelset_id, userId]
              );
            }
          } catch (err) {
            // Log per-record so one bad record doesn't hide failures on the rest.
            console.error(`[wheelset-miles] FAILED activity=${record.activityId} gearId=${record.gearId} userId=${userId}:`, err.message);
          }
        }
      };
      addWheelsetMiles().catch(err => console.error('[ride-conditions] wheelset miles error:', err.message));
    }

    res.json({ success: true, saved: records.length });
  } catch (err) {
    console.error('[ride-conditions] error:', err.message);
    res.status(500).json({ error: 'Failed to save ride conditions' });
  }
});

module.exports = router;
