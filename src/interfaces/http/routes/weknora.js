const express = require('express');

/**
 * WeKnora proxy route.
 *
 * All frontend WeKnora requests go through DCF backend,
 * which injects the service-account token automatically.
 *
 * Routes:
 *   GET  /api/control/weknora/knowledge-bases
 *   GET  /api/control/weknora/search?query=...
 *   POST /api/control/weknora/chat
 *   POST /api/control/weknora/upload/:kbId
 */
function buildWeKnoraProxyRouter(weKnoraService, requirePermission) {
  const router = express.Router();

  if (!weKnoraService) {
    // WeKnora disabled — all routes return 503
    router.use((_req, res) => {
      res.status(503).json({ success: false, error: { message: 'WeKnora RAG 服务未启用' } });
    });
    return router;
  }

  router.get('/knowledge-bases', requirePermission('control:document:read'), async (_req, res, next) => {
    try {
      const result = await weKnoraService.proxy('GET', '/api/v1/knowledge-bases');
      res.json({ success: true, data: result?.data || [] });
    } catch (error) { next(error); }
  });

  router.get('/search', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const query = String(req.query.query || '').trim();
      if (!query) return res.status(400).json({ success: false, error: { message: 'query is required' } });
      const kbIds = req.query.kbIds ? String(req.query.kbIds).split(',') : undefined;
      const results = await weKnoraService.search(query, kbIds);
      res.json({ success: true, data: results });
    } catch (error) { next(error); }
  });

  router.post('/chat', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const { query, sessionId, kbIds } = req.body || {};
      if (!query) return res.status(400).json({ success: false, error: { message: 'query is required' } });

      // For non-streaming, return JSON directly
      if (!req.body.stream) {
        const result = await weKnoraService.query(query, kbIds);
        return res.json({ success: true, ...result });
      }

      // Streaming: proxy the SSE response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const token = await weKnoraService._getToken();
      const http = require('http');
      const url = new URL('/api/v1/chat/completions', weKnoraService.apiUrl);

      const defaultKb = await weKnoraService._ensureDefaultKB();
      const payload = JSON.stringify({
        query,
        session_id: sessionId,
        knowledge_base_ids: kbIds || (defaultKb ? [defaultKb] : []),
        stream: true,
      });

      const proxyReq = http.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 60000,
      }, (proxyRes) => {
        proxyRes.on('data', (chunk) => res.write(chunk));
        proxyRes.on('end', () => res.end());
        proxyRes.on('error', () => res.end());
      });

      proxyReq.on('error', () => {
        res.write('data: {"error":"WeKnora connection failed"}\n\n');
        res.end();
      });
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.write('data: {"error":"WeKnora timeout"}\n\n');
        res.end();
      });

      req.on('close', () => proxyReq.destroy());
      proxyReq.write(payload);
      proxyReq.end();
    } catch (error) { next(error); }
  });

  // POST /api/control/weknora/sync-document — push a DCF document to WeKnora KB
  router.post('/sync-document', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const { id, title, content, type } = req.body || {};
      if (!title && !content) return res.status(400).json({ success: false, error: { message: 'title or content required' } });
      await weKnoraService.syncDocument({ id, title, content, type });
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { buildWeKnoraProxyRouter };
