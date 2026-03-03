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

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
  const adminUiDir = path.join(__dirname, '../interfaces/http/admin-ui');
  app.use('/admin', express.static(adminUiDir));
  app.get('/', (req, res) => res.redirect('/admin'));
  app.use(buildApiRouter(context));

  return app;
}

module.exports = { createServer };
