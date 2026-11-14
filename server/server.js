const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const helmet = require('helmet');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');
const { checkDBReady } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { generalApiRateLimiter } = require('./middleware/rateLimiter');
const { seedInitialData } = require('./utils/seedData');

// Route imports
const authRoutes = require('./routes/authRoutes');
const vegetableRoutes = require('./routes/vegetableRoutes');
const customerRoutes = require('./routes/customerRoutes');
const billRoutes = require('./routes/billRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const backupRoutes = require('./routes/backupRoutes');

const app = express();

let isInitialSeeded = false;
const runInitialSeedOnce = async () => {
  if (isInitialSeeded) return;
  try {
    await seedInitialData();
    isInitialSeeded = true;
  } catch (err) {
    console.warn('[CPN Server] Initial seeding notice:', err.message);
  }
};

// Connect to MongoDB Atlas / Local Database and run idempotent initialization
connectDB()
  .then(() => {
    runInitialSeedOnce();
  })
  .catch((err) => {
    console.error('[CPN Server] Initial database connection error:', err.message);
  });

// Security & Optimization Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  })
);
app.use(compression());

// Configurable CORS protection
const corsOrigin = process.env.CORS_ORIGIN || '*';
const corsOptions =
  corsOrigin === '*'
    ? {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      }
    : {
        origin: corsOrigin.split(',').map((s) => s.trim()),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      };
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static files for uploaded images / logo
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Database connection readiness check & API rate limiting
app.use('/api', checkDBReady);
app.use('/api', generalApiRateLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vegetables', vegetableRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);

// Health check endpoint
app.get(['/api/health', '/health'], async (req, res) => {
  let dbError = null;
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      dbError = err.message;
    }
  }
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'healthy' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    hasMongoUri: Boolean(process.env.MONGODB_URI),
    error: dbError || (isDbConnected ? null : 'Database connection not ready'),
    shop: 'CPN VEGETABLES',
    time: new Date().toISOString(),
  });
});

// Base API index endpoint
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    success: true,
    service: 'CPN VEGETABLES Wholesale Billing API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/login',
      vegetables: '/api/vegetables',
      customers: '/api/customers',
      bills: '/api/bills',
      payments: '/api/payments',
      reports: '/api/reports/dashboard-stats',
      settings: '/api/settings',
      backup: '/api/backup/export',
    },
  });
});

// Serve frontend build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// Catch-all route to serve SPA index.html for client-side routing (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(clientDist, 'index.html');
    return res.sendFile(indexPath);
  }
  next();
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server = null;

// Only start HTTP listener for standalone / local server (never inside Vercel serverless runtime)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(
      `[CPN Server] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'production'} mode`
    );
  });

  // Graceful shutdown handling
  const handleShutdown = (signal) => {
    console.log(`\n[CPN Server] Received ${signal}. Gracefully terminating...`);
    if (server) {
      server.close(async () => {
        console.log('[CPN Server] HTTP server closed.');
        try {
          await mongoose.connection.close(false);
          console.log('[MongoDB] Connection closed cleanly.');
        } catch (err) {
          console.error('[MongoDB] Error during connection close:', err.message);
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

module.exports = app;
