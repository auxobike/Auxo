const express = require('express');
const axios = require('axios');
const requireAuth = require('../middleware/requireAuth');

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
router.get('/bikes', requireAuth, async (req, res) => {
  const token = req.session.access_token;
  console.log('[/api/strava/bikes] token present:', !!token);
  console.log('[/api/strava/bikes] token prefix:', token?.slice(0, 8));
  console.log('[/api/strava/bikes] session expires_at:', req.session.expires_at, '| now:', Math.floor(Date.now() / 1000));

  try {
    const athleteRes = await stravaGet('/athlete', token);
    const athlete    = athleteRes.data;

    console.log('[/api/strava/bikes] Strava /athlete status:', athleteRes.status);
    console.log('[/api/strava/bikes] athlete id:', athlete.id, '| username:', athlete.username);
    console.log('[/api/strava/bikes] bikes array raw:', JSON.stringify(athlete.bikes));

    const bikes = athlete.bikes || [];
    console.log('[/api/strava/bikes] returning', bikes.length, 'bike(s)');

    res.json(bikes);
  } catch (err) {
    console.error('[/api/strava/bikes] Strava error status:', err.response?.status);
    console.error('[/api/strava/bikes] Strava error body:', JSON.stringify(err.response?.data));
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

module.exports = router;
