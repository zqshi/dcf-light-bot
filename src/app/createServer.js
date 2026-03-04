const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { buildApiRouter } = require('../interfaces/http/router');

function isLoopbackAddress(ip) {
  const raw = String(ip || '').trim();
  return raw === '127.0.0.1' || raw === '::1' || raw === '::ffff:127.0.0.1';
}

function createServer(context) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));

  const rateLimitWindowMs = Math.max(1000, Number((context.config && context.config.rateLimitWindowMs) || 15 * 60 * 1000));
  const rateLimitMaxRequests = Math.max(1, Number((context.config && context.config.rateLimitMaxRequests) || 300));
  const apiLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isLoopbackAddress(req.ip) || isLoopbackAddress(req.socket && req.socket.remoteAddress)
  });

  const adminUiDir = path.join(__dirname, '../interfaces/http/admin-ui');
  app.use('/admin', express.static(adminUiDir));
  app.get('/', (req, res) => res.redirect('/admin'));
  app.use('/api', apiLimiter);
  app.use(buildApiRouter(context));

  return app;
}

module.exports = { createServer };
