const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { buildApiRouter } = require('../interfaces/http/router');

function createServer(context) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));

  const rateLimitWindowMs = Math.max(1000, Number((context.config && context.config.rateLimitWindowMs) || 15 * 60 * 1000));
  const rateLimitMaxRequests = Math.max(1, Number((context.config && context.config.rateLimitMaxRequests) || 300));
  app.use(rateLimit({ windowMs: rateLimitWindowMs, max: rateLimitMaxRequests }));
  const adminUiDir = path.join(__dirname, '../interfaces/http/admin-ui');
  app.use('/admin', express.static(adminUiDir));
  app.get('/', (req, res) => res.redirect('/admin'));
  app.use(buildApiRouter(context));

  return app;
}

module.exports = { createServer };
