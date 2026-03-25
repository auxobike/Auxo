const axios = require('axios');

// Middleware: ensure user is logged in, auto-refresh token if expired
async function requireAuth(req, res, next) {
  console.log(`[requireAuth] ${req.method} ${req.path} | token present: ${!!req.session.access_token} | userId: ${req.session.userId || 'none'}`);

  if (!req.session.access_token) {
    console.warn('[requireAuth] rejected — no access_token in session');
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Refresh token if expired (with 60s buffer)
  const now = Math.floor(Date.now() / 1000);
  if (req.session.expires_at && req.session.expires_at < now + 60) {
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: req.session.refresh_token,
        grant_type: 'refresh_token',
      });
      req.session.access_token = response.data.access_token;
      req.session.refresh_token = response.data.refresh_token;
      req.session.expires_at = response.data.expires_at;
    } catch (err) {
      console.error('Auto-refresh failed:', err.message);
      return res.status(401).json({ error: 'Session expired' });
    }
  }

  next();
}

module.exports = requireAuth;
