/**
 * High-performance, zero-dependency in-memory rate limiting middleware
 * Protects login endpoints from brute-force attacks and safeguards APIs from abuse.
 */

// Memory store: key -> { count: number, resetAt: number, blockedUntil?: number }
const loginStore = new Map();
const apiStore = new Map();

// Periodically clean expired rate-limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginStore.entries()) {
    if (now > record.resetAt && (!record.blockedUntil || now > record.blockedUntil)) {
      loginStore.delete(key);
    }
  }
  for (const [key, record] of apiStore.entries()) {
    if (now > record.resetAt) {
      apiStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref(); // .unref() ensures it won't prevent Node process from cleanly exiting

/**
 * Login Rate Limiter:
 * - Max 10 attempts per 15-minute window per IP
 * - Resets on successful login
 * - Returns HTTP 429 with retry delay when triggered
 */
const loginRateLimiter = (req, res, next) => {
  // In automated test mode, bypass rate limit to avoid interfering with fast test loops
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const key = `login_${ip}`;
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 10;
  const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

  let record = loginStore.get(key);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    loginStore.set(key, record);
  }

  if (record.blockedUntil && now < record.blockedUntil) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({
      success: false,
      message: `Too many failed sign-in attempts. For security, access is temporarily locked. Please try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
      retryAfterSeconds: remainingSeconds,
    });
  }

  record.count += 1;

  if (record.count > MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    const remainingSeconds = Math.ceil(BLOCK_DURATION_MS / 1000);
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({
      success: false,
      message: 'Too many failed sign-in attempts. Access temporarily locked for 15 minutes.',
      retryAfterSeconds: remainingSeconds,
    });
  }

  // Intercept response to clear limit on successful login (HTTP 200)
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && body?.success) {
      loginStore.delete(key);
    }
    return originalJson(body);
  };

  next();
};

/**
 * General API Rate Limiter:
 * - Max 300 requests per 1-minute window per IP
 */
const generalApiRateLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const key = `api_${ip}`;
  const now = Date.now();
  const WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS = 300;

  let record = apiStore.get(key);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    apiStore.set(key, record);
  }

  record.count += 1;

  if (record.count > MAX_REQUESTS) {
    const remainingSeconds = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({
      success: false,
      message: 'Too many requests to billing API. Please slow down.',
      retryAfterSeconds: remainingSeconds,
    });
  }

  next();
};

module.exports = {
  loginRateLimiter,
  generalApiRateLimiter,
};
