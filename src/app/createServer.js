const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { buildApiRouter } = require('../interfaces/http/router');

function createServer(context) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
  app.use(buildApiRouter(context));

  return app;
}

module.exports = { createServer };
