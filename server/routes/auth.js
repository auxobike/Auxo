const express = require('express');
const axios   = require('axios');
const bcrypt  = require('bcrypt');
const router  = express.Router();

const { findByEmail, findById, createUser, updateUser, publicUser } = require('../utils/userStore');

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REDIRECT_URI,
  CLIENT_URL,
} = process.env;

const SALT_ROUNDS = 12;

// ── Email/password auth ───────────────────────────────────────────────────────

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, confirm } = req.body;

  if (!email || !password || !confirm) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (password !== confirm) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (findByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = createUser({ email, passwordHash });

    req.session.userId = user.id;
    req.session.user   = publicUser(user);

    res.status(201).json({ success: true, user: publicUser(user) });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  try {
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user.id;
    req.session.user   = publicUser(user);

    // If user has Strava tokens stored, restore them to the session
    if (user.stravaLinked && user.stravaTokens) {
      req.session.access_token  = user.stravaTokens.access_token;
      req.session.refresh_token = user.stravaTokens.refresh_token;
      req.session.expires_at    = user.stravaTokens.expires_at;
      req.session.athlete       = user.stravaTokens.athlete;
    }

    res.json({ success: true, user: publicUser(user), stravaLinked: user.stravaLinked });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── Strava OAuth ──────────────────────────────────────────────────────────────

// GET /auth/strava — redirect to Strava authorization page
router.get('/strava', (req, res) => {
  const params = new URLSearchParams({
    client_id:       STRAVA_CLIENT_ID,
    redirect_uri:    STRAVA_REDIRECT_URI,
    response_type:   'code',
    approval_prompt: 'force',
    scope:           'read,profile:read_all,activity:read_all',
  });
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

// GET /auth/strava/callback
router.get('/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${CLIENT_URL}?auth=error`);
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id:     STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
    });

    const { access_token, refresh_token, expires_at, athlete } = response.data;

    // Store tokens in session
    req.session.athlete       = athlete;
    req.session.access_token  = access_token;
    req.session.refresh_token = refresh_token;
    req.session.expires_at    = expires_at;

    // If logged in via email/password, persist Strava tokens to the user record
    if (req.session.userId) {
      updateUser(req.session.userId, {
        stravaLinked: true,
        stravaId:     String(athlete.id),
        stravaTokens: { access_token, refresh_token, expires_at, athlete },
      });
      req.session.user = publicUser(findById(req.session.userId));
    } else {
      // Strava-only login: store athlete id as the session identifier
      req.session.userId = String(athlete.id);
    }

    res.redirect(`${CLIENT_URL}/dashboard`);
  } catch (err) {
    console.error('Strava OAuth error:', err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}?auth=error`);
  }
});

// POST /auth/refresh — refresh Strava access token
router.post('/refresh', async (req, res) => {
  if (!req.session.refresh_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id:     STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: req.session.refresh_token,
      grant_type:    'refresh_token',
    });

    const { access_token, refresh_token, expires_at } = response.data;
    req.session.access_token  = access_token;
    req.session.refresh_token = refresh_token;
    req.session.expires_at    = expires_at;

    // Keep persisted tokens up to date
    if (req.session.userId) {
      const user = findById(req.session.userId);
      if (user?.stravaLinked) {
        updateUser(req.session.userId, {
          stravaTokens: { ...user.stravaTokens, access_token, refresh_token, expires_at },
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Token refresh error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── Session info ──────────────────────────────────────────────────────────────

// GET /auth/me
router.get('/me', (req, res) => {
  // Must have either a Strava athlete or an email/password user in session
  if (!req.session.athlete && !req.session.userId) {
    return res.status(401).json({ authenticated: false });
  }

  const user         = req.session.userId ? findById(req.session.userId) : null;
  const stravaLinked = user ? user.stravaLinked : !!req.session.athlete;
  const athlete      = req.session.athlete || null;

  res.json({
    authenticated: true,
    athlete,
    stravaLinked,
    user: user ? publicUser(user) : null,
  });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

module.exports = router;
