require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const authRoutes        = require('./routes/auth');
const stravaRoutes      = require('./routes/strava');
const maintenanceRoutes = require('./routes/maintenance');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 1 day
}));

app.use('/auth', authRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/maintenance', maintenanceRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
