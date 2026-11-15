const mongoose = require('mongoose');
const dns = require('dns');

// Ensure reliable SRV DNS lookup for MongoDB Atlas across Windows / ISP networks
// Do not override DNS servers on Linux / Vercel serverless where Lambda internal resolvers must be used
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  } catch (e) {
    // Continue with default resolver if sandbox restricts setServers
  }
}

/**
 * Helper to mask credentials in MongoDB connection string for safe audit logging
 */
const maskUri = (uri) => {
  if (!uri) return 'undefined';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

/**
 * Global cache for Mongoose connection in serverless (Vercel) environments.
 * Prevents re-establishing connections across warm Lambda invocations.
 */
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * High-performance MongoDB Atlas & local connection manager:
 * - Reuses existing warm connection immediately (0ms overhead)
 * - Targets database 'cpn_vegetables_db' (or 'cpn_vegetables_test_db' in test mode)
 * - Serverless-optimized connection pooling (maxPoolSize: 10, minPoolSize: 0)
 * - Fast failover timeouts: 5s server selection, 30s socket timeout
 * - autoIndex disabled in production to eliminate cold-start schema re-indexing latency
 * - Safe credential masking in logs
 */
const connectDB = async () => {
  // 1. If already connected and ready, return existing connection immediately
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection;
    return mongoose.connection;
  }

  // 2. If a cached connection is valid, return it
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // 3. If a connection attempt is already in flight, await the same promise
  if (cached.promise) {
    return cached.promise;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    const errorMsg =
      '[MongoDB] FATAL: MONGODB_URI environment variable is not defined. Please configure Vercel Project Settings > Environment Variables with your MongoDB Atlas connection string.';
    console.error(errorMsg);
    if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  cached.promise = (async () => {
    // Configure event listeners once
    if (mongoose.connection.listenerCount('disconnected') === 0) {
      mongoose.connection.on('connected', () => {
        console.log(
          `[MongoDB] Connection state: CONNECTED (${mongoose.connection.host}/${mongoose.connection.name})`
        );
      });

      mongoose.connection.on('error', (err) => {
        console.error('[MongoDB] Connection error event:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn(
          '[MongoDB] Connection DISCONNECTED. Mongoose will attempt automatic reconnection...'
        );
      });

      mongoose.connection.on('reconnected', () => {
        console.log('[MongoDB] Connection RECONNECTED successfully.');
      });
    }

    let targetDbName = 'cpn_vegetables_db';
    if (
      process.env.NODE_ENV === 'test' ||
      mongoUri.includes('cpn_vegetables_test_db')
    ) {
      targetDbName = 'cpn_vegetables_test_db';
    }

    const isServerless = Boolean(process.env.VERCEL);
    const isProduction = process.env.NODE_ENV === 'production';

    const conn = await mongoose.connect(mongoUri, {
      dbName: targetDbName,
      maxPoolSize: isServerless ? 10 : 20,
      minPoolSize: isServerless ? 0 : 2,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      family: isServerless ? undefined : 4,
      autoIndex: !isProduction, // Disable autoIndex in production to prevent cold-start re-indexing overhead
    });

    cached.conn = conn;
    console.log(
      `[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`
    );
    return conn;
  })()
    .catch((err) => {
      cached.promise = null;
      throw err;
    })
    .finally(() => {
      cached.promise = null;
    });

  return cached.promise;
};

/**
 * Express middleware to prevent database-dependent requests
 * from executing before the database connection is fully established.
 * Automatically awaits connectDB() during cold starts.
 */
const checkDBReady = async (req, res, next) => {
  // Allow health-check without readyState === 1
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error('[MongoDB] Cold start connection error in checkDBReady:', err.message);
      return res.status(503).json({
        success: false,
        message:
          'Database connection is initializing or unavailable. Please retry shortly.',
        error: err.message,
        hasMongoUri: Boolean(process.env.MONGODB_URI),
        readyState: mongoose.connection.readyState,
      });
    }
  }
  next();
};

module.exports = connectDB;
module.exports.checkDBReady = checkDBReady;
module.exports.maskUri = maskUri;
