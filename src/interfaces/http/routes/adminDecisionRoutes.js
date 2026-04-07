/**
 * Decision endpoints for AI Gateway
 * Handles decision requests triggered by risk rules
 */
function registerDecisionRoutes(router, context, deps) {
  const { requireSession } = deps;

  const decisionRequestStore = new Map();

  router.get('/api/admin/ai-gateway/decisions', requireSession, (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    let rows = Array.from(decisionRequestStore.values());

    if (status && status !== 'all') {
      rows = rows.filter((d) => d.responseStatus === status);
    }

    rows.sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      items: rows.slice(0, limit),
      total: rows.length,
      limit
    });
  });

  router.get('/api/admin/ai-gateway/decisions/:decisionId', requireSession, (req, res) => {
    const decisionId = String(req.params.decisionId || '');
    const decision = decisionRequestStore.get(decisionId);
    if (!decision) {
      res.status(404).json({ error: 'decision not found' });
      return;
    }
    res.json(decision);
  });

  router.post('/api/admin/ai-gateway/decisions', requireSession, (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const decisionId = String(body.decisionId || `dr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    const title = String(body.title || '');
    const decisionContext = String(body.context || '');

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const decision = {
      decisionId,
      agentId: String(body.agentId || 'agent-orchestrator'),
      title,
      context: decisionContext,
      recommendation: body.recommendation || {
        id: 'rec-1',
        label: '建议操作',
        description: '基于当前上下文的最优决策',
        reasoning: '根据系统分析生成的建议',
        estimatedImpact: '预计完成相关任务',
        riskLevel: 'medium'
      },
      alternatives: Array.isArray(body.alternatives) ? body.alternatives : [],
      urgency: ['critical', 'high', 'normal', 'low'].includes(body.urgency) ? body.urgency : 'normal',
      deadline: Number(body.deadline) || (Date.now() + 2 * 60 * 60 * 1000),
      responseStatus: 'pending',
      sourceNotificationId: body.sourceNotificationId,
      relatedTaskIds: Array.isArray(body.relatedTaskIds) ? body.relatedTaskIds : [],
      userResponse: null,
      responseAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    decisionRequestStore.set(decisionId, decision);

    if (context.auditService) {
      context.auditService.log('admin.ai-gateway.decision.created', {
        decisionId,
        title,
        urgency: decision.urgency
      });
    }

    res.json({ success: true, decision });
  });

  router.post('/api/admin/ai-gateway/decisions/:decisionId/respond', requireSession, (req, res) => {
    const decisionId = String(req.params.decisionId || '');
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const decision = decisionRequestStore.get(decisionId);
    if (!decision) {
      res.status(404).json({ error: 'decision not found' });
      return;
    }

    if (decision.responseStatus !== 'pending') {
      res.status(400).json({ error: 'decision already responded', currentStatus: decision.responseStatus });
      return;
    }

    const responseAction = String(body.action || '');
    const validActions = ['accept', 'modify', 'decline', 'defer'];

    if (!validActions.includes(responseAction)) {
      res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
      return;
    }

    const updatedDecision = {
      ...decision,
      responseStatus: responseAction === 'defer' ? 'deferred' : responseAction,
      userResponse: String(body.feedback || body.reason || ''),
      responseAt: Date.now(),
      updatedAt: Date.now()
    };

    decisionRequestStore.set(decisionId, updatedDecision);

    if (context.auditService) {
      context.auditService.log('admin.ai-gateway.decision.responded', {
        decisionId,
        action: responseAction,
        feedback: body.feedback || body.reason
      });
    }

    res.json({ success: true, decision: updatedDecision });
  });

  router.post('/api/admin/ai-gateway/decisions/trigger', requireSession, (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const source = String(body.source || 'risk-rule-trigger');
    const sourceId = String(body.sourceId || '');
    const title = String(body.title || '');

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const decision = {
      decisionId: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: String(body.agentId || 'agent-orchestrator'),
      title,
      context: String(body.context || ''),
      recommendation: body.recommendation,
      alternatives: Array.isArray(body.alternatives) ? body.alternatives : [],
      urgency: ['critical', 'high', 'normal', 'low'].includes(body.urgency) ? body.urgency : 'normal',
      deadline: Number(body.deadline) || (Date.now() + 2 * 60 * 60 * 1000),
      responseStatus: 'pending',
      sourceNotificationId: body.sourceNotificationId,
      relatedTaskIds: Array.isArray(body.relatedTaskIds) ? body.relatedTaskIds : [],
      relatedGoalId: body.relatedGoalId,
      userResponse: null,
      responseAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source,
      sourceId,
      extra: body.extra || {}
    };

    decisionRequestStore.set(decision.decisionId, decision);

    if (context.auditService) {
      context.auditService.log('admin.ai-gateway.decision.triggered', {
        decisionId: decision.decisionId,
        source,
        sourceId,
        title
      });
    }

    res.json({ success: true, decision });
  });

  return { decisionRequestStore };
}

module.exports = { registerDecisionRoutes };
