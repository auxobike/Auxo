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
  try {
    const athleteRes = await stravaGet('/athlete', req.session.access_token);
    const bikes = athleteRes.data.bikes || [];
    res.json(bikes);
  } catch (err) {
    console.error('Strava bikes error:', err.response?.data || err.message);
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
