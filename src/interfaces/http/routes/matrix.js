const express = require('express');

function buildMatrixRouter(matrixBot, authService) {
  const router = express.Router();

  router.post('/commands', async (req, res, next) => {
    try {
      authService.verifyMatrixWebhookSecret(req.headers['x-matrix-webhook-secret']);
      const body = req.body || {};
      const result = await matrixBot.processTextMessage(
        body.sender || 'unknown',
        body.roomId || 'unknown-room',
        body.text || ''
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildMatrixRouter };
