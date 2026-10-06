/**
 * Express application wiring: security headers, CORS, rate limiting,
 * body limits, sanitization, routes, 404 + centralized error handler.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const routes = require('./routes');
const { config } = require('./config/env');
const { globalLimiter } = require('./middleware/rateLimit.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

function buildApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // ---- Force HTTPS (production) ----
  // 308 keeps the method and body, so API clients on plain HTTP are moved to
  // the secure origin rather than silently downgraded. Health checks and
  // loopback traffic are exempt so container/load-balancer probes keep working.
  if (config.isProd && config.forceHttps) {
    app.use((req, res, next) => {
      const forwarded = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
      if (req.secure || forwarded === 'https') return next();
      const host = req.get('host') || '';
      if (!host || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) return next();
      if (req.path === '/api/health') return next();
      return res.redirect(308, `https://${host}${req.originalUrl}`);
    });
  }

  // ---- Security headers ----
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd
        ? {
            useDefaults: true,
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'"],
              'style-src': ["'self'", "'unsafe-inline'"],
              'img-src': ["'self'", 'data:'],
              'connect-src': ["'self'", ...config.clientUrls],
              'upgrade-insecure-requests': [],
            },
          }
        : false, // Vite dev server needs relaxed CSP locally
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // ---- CORS (whitelist) ----
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // curl / same-origin
        if (config.clientUrls.includes(origin) || config.isDev) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ---- Performance + logging ----
  app.use(compression());
  if (config.logRequests) app.use(morgan('dev'));

  // ---- Body parsing with strict limits ----
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));

  // ---- Query-projection / operator injection defense ----
  app.use(mongoSanitize());

  // ---- Global rate limit ----
  app.use('/api', globalLimiter);

  // ---- Health check (no auth; deployment probes) ----
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'MedNexus API' });
  });

  // ---- API routes ----
  app.use('/api', routes);

  // ---- 404 + errors ----
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };
