require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const cookieSession = require('cookie-session');
const migrate       = require('./migrate');
const authRoutes        = require('./routes/auth');
const stravaRoutes      = require('./routes/strava');
const maintenanceRoutes = require('./routes/maintenance');
const shopsRoutes       = require('./routes/shops');
const shopRoutes        = require('./routes/shop');
const learnRoutes       = require('./routes/learn');
const garageRoutes      = require('./routes/garage');

const app = express();
const PORT = process.env.PORT || 3001;

// Railway (and most PaaS) terminate TLS at a proxy and forward HTTP internally.
// Without this, Express won't trust X-Forwarded-* headers and cookie behaviour
// can be unpredictable in production.
app.set('trust proxy', 1);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://auxo-production.up.railway.app',
  'https://terrific-contentment-production-d90a.up.railway.app',
  'https://auxo-production-c329.up.railway.app',
  ...(process.env.CLIENT_URL  ? [process.env.CLIENT_URL]  : []),
  ...(process.env.SERVER_URL  ? [process.env.SERVER_URL]  : []),
  ...(process.env.RAILWAY_PUBLIC_DOMAIN ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`] : []),
];

const corsOptions = {
  origin: (origin, cb) => {
    // No origin = same-origin request (browser omits it) or server-to-server — always allow
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials:    true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  exposedHeaders: ['Set-Cookie'],
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// Handle preflight OPTIONS requests explicitly before any other middleware
app.options(/(.*)/, cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json());

// Session is stored entirely in a signed cookie — no server-side store needed.
// This survives Railway container restarts because the data lives in the browser.
const isProduction = process.env.NODE_ENV === 'production';

const sessionCookieConfig = {
  name:     'session',
  keys:     [process.env.SESSION_SECRET || 'dev-secret'],
  httpOnly: true,
  secure:   isProduction,
  sameSite: 'lax',
  maxAge:   24 * 60 * 60 * 1000, // 1 day
};
app.use(cookieSession(sessionCookieConfig));

app.use('/auth', authRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api', shopsRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/learn',   learnRoutes);
app.use('/api/garage', garageRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve React client in production (must come after all API routes)
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get(/(.*)/,  (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('[migrate] failed, aborting startup:', err.message);
    process.exit(1);
  });
