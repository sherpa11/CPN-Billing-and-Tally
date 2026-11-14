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

let connectionPromise = null;

/**
 * Robust MongoDB Atlas & local connection manager:
 * - Reads strictly from MONGODB_URI (no hardcoded fallback credentials)
 * - Targets database 'cpn_vegetables_db' (or 'cpn_vegetables_test_db' in test mode)
 * - Connection pooling: maxPoolSize: 20, minPoolSize: 2
 * - Timeouts: 10s server selection, 45s socket
 * - Graceful event listeners for reconnects and unexpected disconnections
 * - Safe credential masking in logs
 * - Shared Promise memoization ensures callers await until readyState === 1
 */
const connectDB = async () => {
  // If already connected, return existing connection immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If a connection attempt is already in flight, await the same promise
  if (connectionPromise) {
    return connectionPromise;
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

  connectionPromise = (async () => {
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
    const conn = await mongoose.connect(mongoUri, {
      dbName: targetDbName,
      maxPoolSize: isServerless ? 10 : 20,
      minPoolSize: isServerless ? 0 : 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      family: isServerless ? undefined : 4,
      autoIndex: true,
    });

    console.log(
      `[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`
    );
    return conn;
  })().finally(() => {
    connectionPromise = null;
  });

  return connectionPromise;
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
