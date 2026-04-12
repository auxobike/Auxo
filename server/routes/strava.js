const express = require('express');
const axios = require('axios');
const requireAuth = require('../middleware/requireAuth');
const { getBikeData, saveRideConditions } = require('../utils/store');
const { findById } = require('../utils/userStore');

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
  console.log('[/api/strava/bikes] token present:', !!token);
  console.log('[/api/strava/bikes] session expires_at:', req.session.expires_at, '| now:', Math.floor(Date.now() / 1000));

  try {
    // Prefer the bike list already stored in DB — avoids a live Strava round-trip.
    if (req.session.userId) {
      const user = await findById(req.session.userId);
      const cachedBikes = user?.stravaTokens?.athlete?.bikes;
      if (Array.isArray(cachedBikes) && cachedBikes.length > 0) {
        console.log('[/api/strava/bikes] served from DB cache —', cachedBikes.length, 'bike(s)');
        return res.json(cachedBikes);
      }
    }

    // Cache miss — fall back to a live Strava request.
    console.log('[/api/strava/bikes] cache miss — fetching from Strava');
    const athleteRes = await stravaGet('/athlete', token);
    const bikes = athleteRes.data.bikes || [];
    console.log('[/api/strava/bikes] Strava returned', bikes.length, 'bike(s)');
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
    }));

    res.json(rides);
  } catch (err) {
    console.error('[new-rides] error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch new rides' });
  }
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
    .filter(c => c.condition && MULTIPLIERS[c.condition] !== undefined)
    .map(c => ({
      activityId:     String(c.activityId),
      userId,
      gearId:         c.gearId || null,
      condition:      c.condition,
      actualMiles:    Number(c.distanceMiles) || 0,
      effectiveMiles: (Number(c.distanceMiles) || 0) * MULTIPLIERS[c.condition],
    }));

  try {
    await saveRideConditions(records);
    res.json({ success: true, saved: records.length });
  } catch (err) {
    console.error('[ride-conditions] error:', err.message);
    res.status(500).json({ error: 'Failed to save ride conditions' });
  }
});

module.exports = router;
