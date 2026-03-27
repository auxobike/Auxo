require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const session     = require('express-session');
const FileStore   = require('session-file-store')(session);
const authRoutes        = require('./routes/auth');
const stravaRoutes      = require('./routes/strava');
const maintenanceRoutes = require('./routes/maintenance');
const shopsRoutes       = require('./routes/shops');

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://auxo-production.up.railway.app',
  'https://terrific-contentment-production-d90a.up.railway.app',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials:    true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  exposedHeaders: ['Set-Cookie'],
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// Handle preflight OPTIONS requests explicitly before any other middleware
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json());

// Detect production by NODE_ENV OR by CLIENT_URL being an https address.
// Railway does not set NODE_ENV automatically, so CLIENT_URL is the reliable signal.
const isProduction = process.env.NODE_ENV === 'production'
  || (process.env.CLIENT_URL || '').startsWith('https://');

app.use(session({
  store: new FileStore({
    path:   './data/sessions',
    ttl:    86400,  // 1 day in seconds
    reapInterval: 3600, // clean up expired sessions every hour
    logFn: () => {},    // silence verbose file-store logs
  }),
  secret:            process.env.SESSION_SECRET || 'dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge:   24 * 60 * 60 * 1000,
  },
}));

app.use('/auth', authRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api', shopsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
