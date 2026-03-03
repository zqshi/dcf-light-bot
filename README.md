# dcf-light-bot

Control-plane-first multi-tenant OpenClaw hosting platform.

## Core Capabilities
- Matrix command creates one isolated OpenClaw tenant instance.
- Platform-managed provider API keys; tenant users never configure API keys.
- Tenant asset report (skill/tool/knowledge) -> review -> shared publish -> cross-tenant binding workflow.
- Tenant bound assets auto-mounted into OpenClaw runtime config during provision/reconcile/start.
- Audit trail for instance lifecycle and shared-asset operations.
- JWT + RBAC control-plane auth (legacy admin token compatible).
- K8s real-mode idempotent reconcile and rollback on provision failure.
- Runtime proxy in kubernetes mode with retry, circuit breaker, and degraded fallback.
- Asset compatibility validation (`version` / `minOpenclawVersion`) with non-blocking mount isolation.
- Audit retention lifecycle: TTL + max rows + archive ring with scheduled cleanup.
- Multi-level asset review (`requiredApprovals`) with review opinion trail and pending-review queue.
- Review SLA automation (overdue escalation) and review workload dashboard API.
- Prometheus metrics endpoint (`/metrics`) and graded health status (`healthy/degraded/unhealthy`).
- Instance-labeled metrics (`dcf_instance_state_total`, `dcf_instance_failure_reason_total`) and configurable health thresholds.

## Architecture
- Control Plane: instance lifecycle, auth, audit, shared assets.
- Runtime Plane: isolated OpenClaw pod per tenant.
- Asset Plane: shared skill/tool/knowledge registry and bindings.

## Quick Start
```bash
npm install
cp .env.example .env
npm start
```

## Admin Console
- URL: `http://localhost:3000/admin/`
- Built-in static management UI (login, instance/asset/audit/release-preflight views), backed by existing control-plane APIs.
- Supports operational actions:
  - create/start/stop tenant instance
  - review shared asset reports (approve/reject)
  - one-click quick approve/reject on pending asset rows
  - bind shared assets to tenant
  - filter audit logs by `type` / `actor`
  - audit pagination (prev/next cursor) and NDJSON export
  - run release preflight assert and highlight failed checks
  - instance row-level start/stop actions
  - instance detail drawer (runtime/resources/error snapshot)
  - shared asset row-level quick bind to target tenant
  - instance state filter (all/running/provisioning/failed/stopped)
  - instance search by name and tenant id
  - shared asset binding history list
  - shared asset type filter (skill/tool/knowledge)
  - one-click copy for instance/asset/report/binding IDs
  - audit export mode switch (current page / full by filter)

## Persistence Backend
- `PERSISTENCE_BACKEND=file` (default): local JSON file store.
- `PERSISTENCE_BACKEND=postgres`: use Postgres as control-plane store backend.
- When using Postgres, set `POSTGRES_URL` and run migration SQL in [001_control_plane_store.sql](/Users/zqs/Downloads/project/dcf-light-bot/scripts/migrations/001_control_plane_store.sql).

## Kubernetes Deploy
- Manifests: [README.md](/Users/zqs/Downloads/project/dcf-light-bot/deploy/k8s/README.md)
- Apply: `npm run k8s:apply`
- Delete: `npm run k8s:delete`

## Helm Deploy
- Chart guide: [README.md](/Users/zqs/Downloads/project/dcf-light-bot/deploy/helm/README.md)
- Validate chart: `npm run check:helm-chart`
- Install/upgrade:
  - `helm upgrade --install dcf-light-bot deploy/helm/dcf-light-bot --namespace dcf-system --create-namespace -f deploy/helm/dcf-light-bot/values-prod.yaml`

## Auth
- Login: `POST /api/control/auth/login`
- Control APIs: `Authorization: Bearer <jwt-or-admin-token>`

## Matrix Webhook
- `POST /api/integrations/matrix/commands`
- header: `x-matrix-webhook-secret`
- body: `{ "sender": "@u:matrix", "roomId": "!r:matrix", "text": "!create_agent alice" }`

## Key APIs
- `GET /health`
- `GET /status`
- `GET /metrics`
- `POST /api/control/instances`
- `GET /api/control/instances`
- `POST /api/control/assets/reports`
- `GET /api/control/assets/shared?type=tool`
- `POST /api/control/assets/bindings`
- `POST /api/control/skills/reports`
- `POST /api/control/skills/reports/{reportId}/approve`
- `POST /api/control/skills/bindings`
- `POST /api/control/runtime/instances/{instanceId}/invoke`
- `GET /api/control/audits`
- `GET /api/control/audits/export?format=ndjson`
- `GET /api/control/audits?cursor=0&limit=200&sinceId=<lastSeenId>`
- `GET /api/control/release/preflight`
- `POST /api/control/release/preflight/assert`

## Quality Gates
```bash
npm run lint
npm test
npm run verify:openclaw-lock
```

## Ops Checks
- SLO self-check script: `npm run check:platform-slo`
- K8s manifest static check: `npm run check:k8s-manifests`
- Helm chart static check: `npm run check:helm-chart`
- Production helm guardrail check: `npm run check:prod-config`
- Release preflight matrix check: `npm run check:release-preflight`
- Prometheus alert template: [prometheus-alert-rules.yaml](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/prometheus-alert-rules.yaml)
- Grafana dashboard template: [grafana-dashboard-dcf-light-bot.json](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/grafana-dashboard-dcf-light-bot.json)
- Monitoring guide: [README.md](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/README.md)
- Local observability stack:
  - `npm run observability:up`
  - `npm run observability:check`
  - `npm run observability:down`
