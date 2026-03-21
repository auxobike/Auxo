const express = require('express');
const axios = require('axios');
const router = express.Router();

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REDIRECT_URI,
  CLIENT_URL,
} = process.env;

// Step 1: Redirect user to Strava authorization page
router.get('/strava', (req, res) => {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'force',
    scope: 'read,profile:read_all,activity:read_all',
  });
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

// Step 2: Strava redirects back with ?code=...
router.get('/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${CLIENT_URL}?auth=error`);
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_at, athlete } = response.data;

    // Store tokens in session
    req.session.athlete = athlete;
    req.session.access_token = access_token;
    req.session.refresh_token = refresh_token;
    req.session.expires_at = expires_at;

    res.redirect(`${CLIENT_URL}/dashboard`);
  } catch (err) {
    console.error('Strava OAuth error:', err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}?auth=error`);
  }
});

// Refresh access token using stored refresh token
router.post('/refresh', async (req, res) => {
  if (!req.session.refresh_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: req.session.refresh_token,
      grant_type: 'refresh_token',
    });

    const { access_token, refresh_token, expires_at } = response.data;
    req.session.access_token = access_token;
    req.session.refresh_token = refresh_token;
    req.session.expires_at = expires_at;

    res.json({ success: true });
  } catch (err) {
    console.error('Token refresh error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Get current authenticated athlete info
router.get('/me', (req, res) => {
  if (!req.session.athlete) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, athlete: req.session.athlete });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

module.exports = router;
