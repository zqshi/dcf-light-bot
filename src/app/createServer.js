const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { buildApiRouter } = require('../interfaces/http/router');

const PURE_ADMIN_ALLOWED_FILES = new Set([
  'login.html',
  'login.js',
  'employees.html',
  'employees.js',
  'shared-agents.html',
  'shared-agents.js',
  'openclaw-statistics.html',
  'openclaw-statistics.js',
  'openclaw-monitor.html',
  'openclaw-monitor.js',
  'notifications.html',
  'notifications.js',
  'employee-detail-renderer.js',
  'skills.html',
  'skills.js',
  'skill-detail-renderer.js',
  'tools.html',
  'tools.js',
  'logs.js',
  'logs-stats.js',
  'logs-agent.html',
  'logs-service.html',
  'logs-admin.html',
  'auth-members.html',
  'auth-members.js',
  'auth-users.html',
  'auth-roles.html',
  'auth-roles.js',
  'auth.js',
  'auth-core.js',
  'auth-audit.js',
  'app.js',
  'ai-gateway.html',
  'ai-gateway.js',
  'ai-gw.js',
  'ai-gateway-templates.js',
  'layout.css',
  'layout-base.css',
  'layout-drawer-a.css',
  'layout-drawer-b.css',
  'layout-extra.css',
  'tools-approvals.html',
  'tools-approvals.js'
]);


function isLoopbackAddress(ip) {
  const raw = String(ip || '').trim();
  return raw === '127.0.0.1' || raw === '::1' || raw === '::ffff:127.0.0.1';
}

function createServer(context) {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"],
        mediaSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  }));
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

  // Favicon — return 204 to silence browser 404
  app.get('/favicon.ico', (req, res) => res.status(204).end());

  const adminUiDir = path.join(__dirname, '../interfaces/http/admin-ui');
  app.use('/admin', (req, res, next) => {
    const target = String(req.path || '/');
    if (target === '/' || target === '') return res.redirect('/admin/openclaw-statistics.html');
    // Redirect legacy index.html to new landing page
    if (target === '/index.html') return res.redirect('/admin/openclaw-statistics.html');
    const fileName = target.startsWith('/') ? target.slice(1) : target;
    if (!fileName || fileName.includes('..')) {
      res.status(404).send('Not Found');
      return;
    }
    if (!PURE_ADMIN_ALLOWED_FILES.has(fileName)) {
      res.status(404).send('Not Found');
      return;
    }
    next();
  });
  app.use('/admin', express.static(adminUiDir, {
    etag: false,
    lastModified: false,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }));
  app.get('/', (req, res) => res.redirect('/admin/openclaw-statistics.html'));
  app.use('/api', apiLimiter);
  app.use(buildApiRouter(context));

  return app;
}

module.exports = { createServer };
