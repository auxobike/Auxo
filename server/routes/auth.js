const express = require('express');
const axios   = require('axios');
const bcrypt  = require('bcrypt');
const router  = express.Router();

const { findByEmail, findById, createUser, updateUser, publicUser } = require('../utils/userStore');

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
} = process.env;

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Hardcoded — not read from env to prevent misconfigured Railway vars from
// overriding this with a bad value (e.g. the variable name in the value).
const STRAVA_REDIRECT_URI = 'https://auxo-production-c329.up.railway.app/auth/strava/callback';

const SALT_ROUNDS = 12;

// One-time-use code guard — Strava codes are single-use; a second attempt
// with the same code (or a reissued code from a duplicate OAuth flow) will
// fail with 'Authorization Error'. Track seen codes and reject duplicates.
const usedCodes = new Set();
function markCodeUsed(code) {
  usedCodes.add(code);
  setTimeout(() => usedCodes.delete(code), 5 * 60 * 1000); // expire after 5 min
}

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
  console.log('[auth/strava] hit — sessionID:', req.sessionID);
  console.log('[auth/strava] session state:', {
    userId:     req.session.userId,
    hasAthlete: !!req.session.athlete,
  });
  console.log('[auth/strava] redirect_uri:', STRAVA_REDIRECT_URI);

  const params = new URLSearchParams({
    client_id:       STRAVA_CLIENT_ID,
    redirect_uri:    STRAVA_REDIRECT_URI,
    response_type:   'code',
    approval_prompt: 'auto',
    scope:           'read,profile:read_all,activity:read_all',
  });
  const stravaUrl = `https://www.strava.com/oauth/authorize?${params}`;

  // Save the session to disk before leaving for Strava so the userId from
  // email/password login is guaranteed to be persisted when the callback hits.
  req.session.save((err) => {
    if (err) console.error('[auth/strava] session.save() error:', err);
    else console.log('[auth/strava] session saved, redirecting to Strava');
    res.redirect(stravaUrl);
  });
});

// GET /auth/strava/callback
router.get('/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  console.log('[callback] hit — sessionID:', req.sessionID);
  console.log('[callback] query:', req.query);
  console.log('[callback] session before token exchange:', {
    userId:          req.session.userId,
    hasAthlete:      !!req.session.athlete,
    hasAccessToken:  !!req.session.access_token,
  });

  // Guard: if the session already has a token this is a duplicate request
  // (e.g. browser retry or client-side router re-navigation). The first
  // request already exchanged the code — codes are single-use, so skip.
  if (req.session.access_token) {
    console.log('[callback] duplicate hit — session already has access_token, redirecting to /dashboard');
    return res.redirect('/dashboard');
  }

  if (error || !code) {
    console.log('[callback] auth error from Strava, redirecting to /?auth=error');
    return res.redirect('/?auth=error');
  }

  if (usedCodes.has(code)) {
    console.log('[callback] duplicate code detected — already used, redirecting to /dashboard');
    return res.redirect('/dashboard');
  }
  markCodeUsed(code);

  // Real body sent to Strava — contains the actual client_secret.
  const requestBody = new URLSearchParams({
    client_id:     STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    redirect_uri:  STRAVA_REDIRECT_URI,
    grant_type:    'authorization_code',
  });

  // Separate object used only for logging — client_secret replaced with its length.
  const logBody = new URLSearchParams({
    client_id:     STRAVA_CLIENT_ID,
    client_secret: `[length:${(STRAVA_CLIENT_SECRET || '').length}]`,
    code,
    redirect_uri:  STRAVA_REDIRECT_URI,
    grant_type:    'authorization_code',
  });

  console.log('[callback] token exchange — POST https://www.strava.com/oauth/token');
  console.log('[callback] request body:', logBody.toString());

  try {
    // Strava requires application/x-www-form-urlencoded, not JSON.
    const response = await axios.post(
      'https://www.strava.com/oauth/token',
      requestBody,
    );

    const { access_token, refresh_token, expires_at, athlete } = response.data;
    console.log('[callback] token exchange success — athlete id:', athlete?.id);

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

    console.log('[callback] session after update — userId:', req.session.userId, 'sessionID:', req.sessionID);
    console.log('[callback] calling session.save()...');

    // Save session to store before redirecting — redirect is relative so the
    // browser stays on the same domain and the session cookie is sent back.
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('[callback] session.save() error:', saveErr);
      } else {
        console.log('[callback] session.save() succeeded — redirecting to /dashboard');
      }
      res.redirect('/dashboard');
    });
  } catch (err) {
    console.error('[callback] Strava OAuth error — POST https://www.strava.com/oauth/token');
    console.error('[callback] request body sent:', logBody.toString());
    console.error('[callback] response status:', err.response?.status);
    console.error('[callback] response headers:', err.response?.headers);
    console.error('[callback] response data:', JSON.stringify(err.response?.data));
    console.error('[callback] error message:', err.message);
    res.redirect('/?auth=error');
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
