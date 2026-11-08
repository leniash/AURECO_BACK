require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const stateRoutes = require('./routes/state');
const aiRoutes = require('./routes/ai');
const guestAccessRoutes = require('./routes/guestAccess');
const publicProfileRoutes = require('./routes/publicProfile');
const lettersRoutes = require('./routes/letters');
const directoryRoutes = require('./routes/directory');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable TLS reject unauthorized bypass if needed in constrained local proxies
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  console.warn('[SECURITY WARNING] TLS certificate validation disabled for local proxy.');
}

// CORS setup: allow Vercel frontends and local dev
const allowedOrigins = [
  'http://localhost:8000',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:5500'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/+$/, ''));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    // Permissive for development & staging
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'x-guest-token']
}));

// Body parser with 20MB limit for profile images and certificates
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Africa University Recommendation API',
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.send('Africa University Student Recommendation & Portfolio Backend API is Running.');
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/guest', guestAccessRoutes);
app.use('/api/public', publicProfileRoutes);
app.use('/api/letters', lettersRoutes);
app.use('/api/directory', directoryRoutes);

app.use('/api/legal', require('./routes/legal'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'That is too much data to save. Try smaller images.' });
  }
  res.status(500).json({ message: err.message || 'Internal server error.' });
});

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Africa University Backend API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
