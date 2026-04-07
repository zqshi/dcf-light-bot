const express = require('express');
const { buildInstanceRouter } = require('./routes/instances');
const { buildSkillRouter } = require('./routes/skills');
const { buildHealthRouter } = require('./routes/health');
const { buildMatrixRouter } = require('./routes/matrix');
const { buildAuditRouter } = require('./routes/audits');
const { buildAuthRouter } = require('./routes/auth');
const { buildRuntimeRouter } = require('./routes/runtime');
const { buildAssetRouter } = require('./routes/assets');
const { buildReleaseRouter } = require('./routes/release');
const { buildDocumentRouter } = require('./routes/documents');
const { buildCategoryRouter } = require('./routes/categories');
const { buildKnowledgeAuditRouter } = require('./routes/knowledgeAudits');
const { buildStorageRouter } = require('./routes/storage');
const { buildUploadRouter } = require('./routes/uploads');
const { buildWeKnoraProxyRouter } = require('./routes/weknora');
const { buildAdminCompatRouter } = require('./routes/adminCompat');
const { buildAdminAnalyticsRouter } = require('./routes/adminAnalytics');
const { buildControlAuthMiddleware, buildPermissionMiddleware } = require('./middleware/controlAuth');
const { buildRequestContextMiddleware } = require('./middleware/requestContext');

function buildApiRouter(context) {
  const router = express.Router();
  router.use(buildRequestContextMiddleware());

  router.use(buildHealthRouter(context));
  router.use(buildAdminCompatRouter(context));
  router.use(buildAdminAnalyticsRouter(context));
  router.use('/api/integrations/matrix', buildMatrixRouter(context.matrixBot, context.authService));
  router.use('/api/control/auth', buildAuthRouter(context.authService, context.auditService));

  const controlAuth = buildControlAuthMiddleware(context.authService);
  const requirePermission = (permission) => buildPermissionMiddleware(context.authService, permission);

  router.use('/api/control', controlAuth);
  router.use('/api/control/instances', buildInstanceRouter(context.instanceService, requirePermission));
  router.use('/api/control/audits', buildAuditRouter(context.auditService, requirePermission));
  const assetService = context.assetService || context.skillService;
  router.use('/api/control/assets', buildAssetRouter(assetService, requirePermission, context.metricsService));
  router.use('/api/control/skills', buildSkillRouter(context.skillService, requirePermission));
  router.use('/api/control/runtime', buildRuntimeRouter(context.runtimeProxyService, requirePermission));
  if (context.documentService) {
    router.use('/api/control/documents', buildDocumentRouter(context.documentService, requirePermission));
  }
  if (context.categoryService) {
    router.use('/api/control/categories', buildCategoryRouter(context.categoryService, requirePermission));
  }
  if (context.knowledgeAuditService) {
    router.use('/api/control/knowledge-audits', buildKnowledgeAuditRouter(context.knowledgeAuditService, requirePermission));
  }
  if (context.storageService) {
    router.use('/api/control/storage', buildStorageRouter(context.storageService, requirePermission));
  }
  router.use('/api/control/uploads', buildUploadRouter(context.config, requirePermission));
  if (context.weKnoraService || context.config.weKnoraEnabled) {
    router.use('/api/control/weknora', buildWeKnoraProxyRouter(context.weKnoraService, requirePermission));
  }
  if (context.releasePreflightService) {
    router.use('/api/control/release', buildReleaseRouter(context.releasePreflightService, requirePermission));
  }

  router.use((error, req, res, _next) => {
    const status = Number(error.statusCode || 0) || 500;
    res.status(status).json({
      success: false,
      error: {
        message: error.message || 'internal error',
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  });

  return router;
}

module.exports = { buildApiRouter };
