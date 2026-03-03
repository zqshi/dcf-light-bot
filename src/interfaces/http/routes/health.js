const express = require('express');

function buildHealthRouter(context) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    res.json({
      ok: true,
      ts: new Date().toISOString(),
      mode: context.config.kubernetesSimulationMode ? 'simulation' : 'kubernetes'
    });
  });

  router.get('/status', async (req, res) => {
    const audits = await context.auditService.list(20);
    const instances = await context.instanceService.list();
    const reports = await context.skillService.listReports();
    res.json({
      ok: true,
      instances: instances.length,
      skillReports: reports.length,
      recentAuditCount: audits.length
    });
  });

  return router;
}

module.exports = { buildHealthRouter };
