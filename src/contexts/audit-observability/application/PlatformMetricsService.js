const client = require('prom-client');

class PlatformMetricsService {
  constructor() {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({ register: this.registry });

    this.reviewPendingGauge = new client.Gauge({
      name: 'dcf_review_pending_total',
      help: 'Total pending asset reviews',
      registers: [this.registry]
    });
    this.reviewOverdueGauge = new client.Gauge({
      name: 'dcf_review_overdue_total',
      help: 'Total overdue asset reviews',
      registers: [this.registry]
    });
    this.reviewEscalatedGauge = new client.Gauge({
      name: 'dcf_review_escalated_total',
      help: 'Total escalated pending reviews',
      registers: [this.registry]
    });
    this.reviewQueueGauge = new client.Gauge({
      name: 'dcf_review_reviewer_queue_total',
      help: 'Pending review queue size for current reviewer context',
      registers: [this.registry]
    });
    this.auditRecentGauge = new client.Gauge({
      name: 'dcf_audit_recent_total',
      help: 'Recent audit records observed by status snapshot',
      registers: [this.registry]
    });
    this.instancesGauge = new client.Gauge({
      name: 'dcf_instances_total',
      help: 'Total managed tenant instances',
      registers: [this.registry]
    });
    this.instanceStateGauge = new client.Gauge({
      name: 'dcf_instance_state_total',
      help: 'Managed instances by state',
      labelNames: ['state'],
      registers: [this.registry]
    });
    this.instanceFailureReasonGauge = new client.Gauge({
      name: 'dcf_instance_failure_reason_total',
      help: 'Managed instances by failure reason bucket',
      labelNames: ['reason'],
      registers: [this.registry]
    });
    this.healthGauge = new client.Gauge({
      name: 'dcf_health_state',
      help: 'Platform health level (healthy=2, degraded=1, unhealthy=0)',
      registers: [this.registry]
    });
    this.reviewEscalationCounter = new client.Counter({
      name: 'dcf_review_escalation_events_total',
      help: 'Total review escalation events',
      labelNames: ['trigger'],
      registers: [this.registry]
    });
  }

  setReviewDashboard(dashboard) {
    const d = dashboard || {};
    this.reviewPendingGauge.set(Number(d.pendingTotal || 0));
    this.reviewOverdueGauge.set(Number(d.overdueTotal || 0));
    this.reviewEscalatedGauge.set(Number(d.escalatedTotal || 0));
    this.reviewQueueGauge.set(Number(d.reviewerQueue || 0));
  }

  setStatusSnapshot(snapshot) {
    const s = snapshot || {};
    this.instancesGauge.set(Number(s.instances || 0));
    this.auditRecentGauge.set(Number(s.recentAuditCount || 0));
    if (s.instanceStateCounts && typeof s.instanceStateCounts === 'object') {
      this.instanceStateGauge.reset();
      for (const [state, count] of Object.entries(s.instanceStateCounts)) {
        this.instanceStateGauge.set({ state: String(state) }, Number(count || 0));
      }
    }
    if (s.instanceFailureReasons && typeof s.instanceFailureReasons === 'object') {
      this.instanceFailureReasonGauge.reset();
      for (const [reason, count] of Object.entries(s.instanceFailureReasons)) {
        this.instanceFailureReasonGauge.set({ reason: String(reason) }, Number(count || 0));
      }
    }
    const level = String(s.healthLevel || 'healthy');
    const value = level === 'unhealthy' ? 0 : (level === 'degraded' ? 1 : 2);
    this.healthGauge.set(value);
  }

  recordEscalationEvents(count, trigger = 'manual') {
    const n = Math.max(0, Number(count || 0));
    if (!n) return;
    this.reviewEscalationCounter.inc({ trigger: String(trigger || 'manual') }, n);
  }

  async renderMetrics() {
    return this.registry.metrics();
  }
}

module.exports = { PlatformMetricsService };
