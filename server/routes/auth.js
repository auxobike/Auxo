const express = require('express');
const axios   = require('axios');
const bcrypt  = require('bcrypt');
const router  = express.Router();

const { findByEmail, findById, findByStravaId, createUser, createStravaUser, updateUser, deleteUser, publicUser } = require('../utils/userStore');
const { createShop } = require('../utils/shopStore');
const { getConfiguredBikeIds, deleteBikeData } = require('../utils/store');
const { syncEffectiveMileageForUser } = require('../utils/effectiveMileage');

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
  if (await findByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createUser({ email, passwordHash });

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

  const user = await findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  try {
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Store previous login time in session (used by /api/strava/new-rides),
    // then update last_login_at to NOW so the next login gets a fresh window.
    req.session.lastLoginAt = user.lastLoginAt || null;
    await updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    req.session.userId = user.id;
    req.session.user   = publicUser(user);

    // If user has Strava tokens stored, restore them to the session.
    // Trim athlete to the same fields stored at OAuth time — the full
    // stravaTokens.athlete object (with bikes, shoes, clubs) is too large
    // for the 4 KB cookie-session limit and will silently corrupt the cookie.
    let sessionAthlete = null;
    if (user.stravaLinked && user.stravaTokens) {
      req.session.access_token  = user.stravaTokens.access_token;
      req.session.refresh_token = user.stravaTokens.refresh_token;
      req.session.expires_at    = user.stravaTokens.expires_at;
      const a = user.stravaTokens.athlete;
      sessionAthlete = a ? {
        id:                     a.id,
        firstname:              a.firstname,
        lastname:               a.lastname,
        profile:                a.profile,
        profile_medium:         a.profile_medium,
        username:               a.username,
        measurement_preference: a.measurement_preference,
      } : null;
      req.session.athlete = sessionAthlete;
    }

    // Fire-and-forget: refresh stored effective mileage for all linked bikes.
    const loginBikes = user.stravaTokens?.athlete?.bikes ?? [];
    if (loginBikes.length > 0) {
      syncEffectiveMileageForUser(loginBikes.map(b => b.id), user.id)
        .catch(err => console.error('[login] effectiveMileage sync error:', err.message));
    }

    res.json({ success: true, user: publicUser(user), stravaLinked: user.stravaLinked, athlete: sessionAthlete });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /auth/shop/register — creates a shop-account user plus its shops row.
// Gated by an invite code checked against SHOP_INVITE_CODES (comma-separated
// list in server/.env) so shop signup isn't open to the public yet.
router.post('/shop/register', async (req, res) => {
  const { inviteCode, shopName, email, password, confirm } = req.body;

  if (!inviteCode || !shopName || !email || !password || !confirm) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (password !== confirm) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const validCodes = (process.env.SHOP_INVITE_CODES || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);
  if (!validCodes.includes(inviteCode.trim())) {
    return res.status(403).json({ error: 'Invalid invite code.' });
  }

  if (await findByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createUser({ email, passwordHash, accountType: 'shop' });
    await createShop({ userId: user.id, name: shopName, inviteCode: inviteCode.trim() });

    req.session.userId = user.id;
    req.session.user   = publicUser(user);

    res.status(201).json({ success: true, user: publicUser(user) });
  } catch (err) {
    console.error('Shop register error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── Strava OAuth ──────────────────────────────────────────────────────────────

// GET /auth/strava — redirect to Strava authorization page
router.get('/strava', (req, res) => {
  const params = new URLSearchParams({
    client_id:       STRAVA_CLIENT_ID,
    redirect_uri:    STRAVA_REDIRECT_URI,
    response_type:   'code',
    approval_prompt: 'auto',
    scope:           'read,profile:read_all,activity:read_all',
  });
  const stravaUrl = `https://www.strava.com/oauth/authorize?${params}`;

  // cookie-session writes automatically with the response — no save() needed.
  res.redirect(stravaUrl);
});

// GET /auth/strava/callback
router.get('/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  // Guard: if the session already has a token this is a duplicate request
  // (e.g. browser retry or client-side router re-navigation). The first
  // request already exchanged the code — codes are single-use, so skip.
  if (req.session.access_token) {
    return res.redirect('/dashboard');
  }

  if (error || !code) {
    return res.redirect('/?auth=error');
  }

  if (usedCodes.has(code)) {
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

  try {
    // Strava requires application/x-www-form-urlencoded, not JSON.
    const response = await axios.post(
      'https://www.strava.com/oauth/token',
      requestBody,
    );

    const { access_token, refresh_token, expires_at, athlete } = response.data;

    // Store only the fields the client actually uses — keeps the cookie small.
    // Full athlete data (bikes, shoes, clubs, etc.) would push it over 4 KB.
    req.session.athlete = {
      id:                   athlete.id,
      firstname:            athlete.firstname,
      lastname:             athlete.lastname,
      profile:              athlete.profile,
      profile_medium:       athlete.profile_medium,
      username:             athlete.username,
      measurement_preference: athlete.measurement_preference,
    };
    req.session.access_token  = access_token;
    req.session.refresh_token = refresh_token;
    req.session.expires_at    = expires_at;

    // If logged in via email/password, persist Strava tokens to the user record
    if (req.session.userId) {
      // Read lastLoginAt BEFORE updating so we can pass the previous value to
      // the new-rides endpoint (which shows rides since the last login).
      const userBefore = await findById(req.session.userId);
      req.session.lastLoginAt = userBefore?.lastLoginAt || null;

      const updatedUser = await updateUser(req.session.userId, {
        stravaLinked: true,
        stravaId:     String(athlete.id),
        stravaTokens: { access_token, refresh_token, expires_at, athlete },
        lastLoginAt:  new Date().toISOString(),
      });
      req.session.user = publicUser(updatedUser);
    } else {
      // Strava-only login (no email/password session): look up a user row by
      // strava_id so lastLoginAt can still be tracked across visits. Create
      // one on first login so there's a row to update going forward.
      const stravaIdStr = String(athlete.id);
      const existingUser = await findByStravaId(stravaIdStr);

      let stravaUser;
      if (existingUser) {
        req.session.lastLoginAt = existingUser.lastLoginAt || null;
        stravaUser = await updateUser(existingUser.id, {
          stravaLinked: true,
          stravaTokens: { access_token, refresh_token, expires_at, athlete },
          lastLoginAt:  new Date().toISOString(),
        });
      } else {
        req.session.lastLoginAt = null;
        stravaUser = await createStravaUser({
          stravaId:     stravaIdStr,
          stravaTokens: { access_token, refresh_token, expires_at, athlete },
        });
      }

      req.session.userId = stravaUser.id;
      req.session.user   = publicUser(stravaUser);
    }

    // Fire-and-forget: refresh stored effective mileage for all linked bikes.
    const callbackBikes = athlete?.bikes ?? [];
    if (callbackBikes.length > 0 && req.session.userId) {
      syncEffectiveMileageForUser(callbackBikes.map(b => b.id), req.session.userId)
        .catch(err => console.error('[strava/callback] effectiveMileage sync error:', err.message));
    }

    // New users (no configured bikes) go to /add-bike; returning users go to /dashboard.
    const configuredIds = await getConfiguredBikeIds();
    const redirectTo = configuredIds.length === 0 ? '/add-bike' : '/dashboard';
    res.redirect(redirectTo);
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
      const user = await findById(req.session.userId);
      if (user?.stravaLinked) {
        await updateUser(req.session.userId, {
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
router.get('/me', async (req, res) => {
  // Must have either a Strava athlete or an email/password user in session
  if (!req.session?.athlete && !req.session?.userId) {
    return res.status(401).json({ authenticated: false });
  }

  const user         = req.session.userId ? await findById(req.session.userId) : null;
  const stravaLinked = !!req.session.access_token;
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
  req.session = null; // cookie-session: setting to null clears the cookie
  res.json({ success: true });
});

// POST /auth/change-password
router.post('/change-password', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { currentPassword, newPassword, confirm } = req.body;
  if (!currentPassword || !newPassword || !confirm) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (newPassword !== confirm) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const user = await findById(req.session.userId);
    if (!user?.passwordHash) {
      return res.status(400).json({ error: 'No password set for this account.' });
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await updateUser(req.session.userId, { passwordHash: newHash });
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// PUT /auth/preferences
router.put('/preferences', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { warnThreshold } = req.body;
  const VALID = [5, 10, 15, 20];
  if (!VALID.includes(Number(warnThreshold))) {
    return res.status(400).json({ error: `warnThreshold must be one of: ${VALID.join(', ')}` });
  }

  try {
    const user = await findById(req.session.userId);
    const updated = await updateUser(req.session.userId, {
      preferences: { ...(user?.preferences ?? {}), warnThreshold: Number(warnThreshold) },
    });
    res.json({ success: true, preferences: updated.preferences });
  } catch (err) {
    console.error('Update preferences error:', err.message);
    res.status(500).json({ error: 'Failed to save preferences.' });
  }
});

// DELETE /auth/account
router.delete('/account', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const user = await findById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Delete bike data for all known Strava bikes belonging to this athlete
    const bikeIds = user.stravaTokens?.athlete?.bikes?.map(b => b.id) ?? [];
    await deleteBikeData(bikeIds);
    await deleteUser(req.session.userId);

    req.session = null;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

module.exports = router;
