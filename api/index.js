const app = require('../server/server');

/**
 * Vercel Serverless Function entry point for CPN VEGETABLES Express backend.
 * Routes all /api/* requests to Express while ensuring the /api prefix
 * is properly preserved regardless of proxy rewriting behavior.
 */
module.exports = (req, res) => {
  // Ensure the URL path retains the /api prefix inside Express
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req, res);
};
