require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const fs          = require('fs');
const session     = require('express-session');
const FileStore   = require('session-file-store')(session);
const authRoutes        = require('./routes/auth');
const stravaRoutes      = require('./routes/strava');
const maintenanceRoutes = require('./routes/maintenance');
const shopsRoutes       = require('./routes/shops');

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

// Now that frontend is served from the same domain as the backend,
// we can use sameSite: 'lax' in production (no cross-domain cookies needed).
const isProduction = process.env.NODE_ENV === 'production';

// Ensure the sessions directory exists before FileStore tries to use it.
// Using an absolute path avoids ambiguity about cwd inside the container.
const SESSION_DIR = path.join(__dirname, 'data/sessions');
fs.mkdirSync(SESSION_DIR, { recursive: true });
console.log('[session] store path:', SESSION_DIR);

const sessionCookieConfig = {
  httpOnly: true,
  secure:   isProduction,
  sameSite: 'lax',
  maxAge:   24 * 60 * 60 * 1000,
};
console.log('[session] cookie config:', sessionCookieConfig);

app.use(session({
  store: new FileStore({
    path:         SESSION_DIR,
    ttl:          86400,       // 1 day in seconds
    reapInterval: 3600,        // clean up expired sessions every hour
    logFn:        () => {},    // silence verbose file-store logs
  }),
  secret:            process.env.SESSION_SECRET || 'dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie:            sessionCookieConfig,
}));

app.use('/auth', authRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api', shopsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve React client in production (must come after all API routes)
if (process.env.NODE_ENV === 'production') {
  console.log('[static] __dirname:', __dirname);
  const clientDist = path.join(__dirname, '../client/dist');
  console.log('[static] clientDist path:', path.join(__dirname, '../client/dist'));
  console.log('[static] serving client from:', clientDist);
  app.use(express.static(clientDist));
  app.get(/(.*)/,  (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
