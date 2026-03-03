# TASKS: Phase0-1 Instance MVP

## Done
- [x] Restructure codebase into DDD-oriented modules.
- [x] Implement control-plane persistence repository.
- [x] Implement instance lifecycle service and state transitions.
- [x] Implement skill report ingest service.
- [x] Implement audit service.
- [x] Implement matrix command entry for create_agent.
- [x] Implement HTTP routes for instances and skill reports.
- [x] Add tests for instance creation and skill report.
- [x] Add ADR and runbook baseline files.
- [x] Add control-plane admin auth middleware.
- [x] Add instance creation idempotency via requestId.
- [x] Add bootstrap reconciler loop for provisioning timeout.
- [x] Add matrix webhook command API with shared secret verification.
- [x] Add shared skill approval and cross-tenant binding workflow.
- [x] Upgrade auth to JWT + RBAC permissions with legacy admin token compatibility.
- [x] Generalize shared center to assets: skill/tool/knowledge report-review-bind workflow.
- [x] Add `/api/control/assets/*` routes for enterprise shared assets.
- [x] Implement runtime proxy kubernetes mode with retry/circuit-breaker/degraded fallback.
- [x] Auto-mount tenant bound assets into OpenClaw runtime config during provision/reconcile/start.
- [x] Add asset compatibility validation and non-blocking mount isolation.

## Next
- [x] Real Kubernetes reconciler baseline with idempotent apply and rollback on provision failure.
- [x] Postgres repository adapter and migration scripts.
