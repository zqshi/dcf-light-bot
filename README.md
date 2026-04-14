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

## Local Matrix + OpenClaw Stack
- Start: `npm run openclaw:up`
- Check: `npm run openclaw:check`
- Smoke: `npm run openclaw:smoke`
- Stop: `npm run openclaw:down`
- Exposed endpoints:
  - Matrix Synapse: `http://127.0.0.1:8008`
  - Matrix Web Client (Element): `http://127.0.0.1:8081`
  - OpenClaw Gateway UI: `http://127.0.0.1:18789`
  - DCF Admin Console: `http://127.0.0.1:3010/admin/login.html`
  - DCF App Status: `http://127.0.0.1:3010/status`

## Local All-In-One Ops
- Start all (`matrix + openclaw + dcf app`): `npm run start:all`
- Check all (includes Matrix + browser-use user E2E): `npm run check:all`
- Run user behavior E2E only: `npm run e2e:user`
- Stop all: `npm run stop:all`
- App-only:
  - Start: `npm run start:app`
  - Check: `npm run check:app`
  - Stop: `npm run stop:app`

## Admin Console
- URL: `http://127.0.0.1:3010/admin/login.html`
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
  - audit trace aggregation by instance id
  - batch asset review (approve/reject multiple report IDs)
  - server-side audit trace API and server-side batch review API
  - server-side instance query filters (`state/name/tenantId`)
  - server-side audit `instanceId` filter
  - batch asset binding API
  - batch instance action API (`start/stop`) and admin console batch action form
  - batch failure detail panels (instance action / asset review / asset binding)
  - audit trace export (JSON / NDJSON) from instance trace view

## Client Experience Spec
- PRD: [PRD.md](docs/specs/client-experience/PRD.md)
- IA: [IA.md](docs/specs/client-experience/IA.md)
- API Contract: [API-CONTRACT.md](docs/specs/client-experience/API-CONTRACT.md)
- Acceptance: [ACCEPTANCE.md](docs/specs/client-experience/ACCEPTANCE.md)
- Tasks: [TASKS.md](docs/specs/client-experience/TASKS.md)
- Matrix Desktop/Mobile Runbook: [matrix-clients.md](docs/runbooks/matrix-clients.md)

## Persistence Backend
- `PERSISTENCE_BACKEND=sqlite` (default): local SQLite database.
- `PERSISTENCE_BACKEND=file`: local JSON file store (legacy).
- `PERSISTENCE_BACKEND=postgres`: use Postgres as control-plane store backend.
- When using Postgres, set `POSTGRES_URL` and run migration SQL in [001_control_plane_store.sql](scripts/migrations/001_control_plane_store.sql).

## Kubernetes Deploy
- Manifests: [README.md](deploy/k8s/README.md)
- Apply: `npm run k8s:apply`
- Delete: `npm run k8s:delete`

## Helm Deploy
- Chart guide: [README.md](deploy/helm/README.md)
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

## Matrix Relay (Real Room Message Inbound)
- Set `.env`:
  - `MATRIX_HOMESERVER` (example: `http://127.0.0.1:8008`)
  - `MATRIX_USER_ID` (example: `@dcfbot:localhost`)
  - `MATRIX_ACCESS_TOKEN`
  - `MATRIX_PASSWORD` (optional fallback when no access token is provided)
  - `MATRIX_RELAY_ENABLED=true`
  - `MATRIX_CONVERSATION_MODE=openclaw_channel` (default, DCF bot does not proxy employee-room chats)
- Optional provider defaults for OpenClaw tenant config:
  - `MINIMAX_API_KEY`, `MINIMAX_API_BASE`, `MINIMAX_MODEL`
  - `DEEPSEEK_API_BASE`, `DEEPSEEK_MODEL`
  - default permission template for newly created digital employees:
    - `OPENCLAW_PERMISSION_TEMPLATE_JSON` (JSON, optional; if empty uses OpenClaw default template)
  - compatibility aliases are also supported for MiniMax Anthropic endpoint style:
    - `ANTHROPIC_AUTH_TOKEN` (same as `MINIMAX_API_KEY`)
    - `ANTHROPIC_BASE_URL` (same as `MINIMAX_API_BASE`)
  - shell export example:
    - `export MINIMAX_API_BASE=https://api.minimaxi.com/anthropic`
    - `export MINIMAX_API_KEY=<your_key>`
- Start app and relay will bridge factory commands to control-plane handler.
- Matrix message patterns:
  - create employee (factory command): `!create_agent <name>`
  - natural language create in factory DM is also supported (example: `请创建一个采购数字员工，名字叫采购小助手`)
  - query provisioning job: `!job_status <requestId>`
  - in a bound employee room:
    - `openclaw_channel` mode (default): DCF bot delegates conversation to OpenClaw Matrix channel
    - `runtime_proxy` mode: legacy fallback, DCF bot forwards text to runtime proxy
- Run E2E bootstrap/validation:
  - `npm run matrix:e2e`
  - `npm run e2e:full` (full chain: stack health + matrix create + admin API acceptance)
  - `npm run e2e:user` (Matrix real room + browser-use admin UI assertion)

## Matrix Test Users (Local)
- Bot user (created/maintained by start scripts): `@dcfbot:localhost` / `dcfbot123`
- Operator user (used by E2E): `@opsuser:localhost` / `opsuser123`
- Login through Element Web at `http://127.0.0.1:8081` with homeserver `http://127.0.0.1:8008`.
- Bot display name defaults to `数字工厂bot`; users can search this contact in Matrix, open a DM, and create digital employees via natural language (for example: `请创建一个采购数字员工，名字叫采购小助手`).

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
- `GET /api/admin/agents/shared`
- `POST /api/admin/agents/shared/register`
- `POST /api/admin/agents/shared/{id}`
- `POST /api/admin/agents/shared/{id}/delete`
- `GET /api/admin/agents/shared/recommend`
- `POST /api/admin/agents/shared/auto-bind/{employeeId}`
- `POST /api/admin/employees/{id}/sync-identity`
- `GET /api/control/audits`
- `GET /api/control/audits/export?format=ndjson`
- `GET /api/control/audits?cursor=0&limit=200&sinceId=<lastSeenId>`
- `GET /api/control/audits/trace/instances/{instanceId}`
- `GET /api/control/release/preflight`
- `POST /api/control/release/preflight/assert`
- `POST /api/control/assets/reviews/batch`
- `POST /api/control/assets/bindings/batch`
- `POST /api/control/instances/batch-actions`

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
- Prometheus alert template: [prometheus-alert-rules.yaml](docs/monitoring/prometheus-alert-rules.yaml)
- Grafana dashboard template: [grafana-dashboard-dcf-light-bot.json](docs/monitoring/grafana-dashboard-dcf-light-bot.json)
- Monitoring guide: [README.md](docs/monitoring/README.md)
- Local observability stack:
  - `npm run observability:up`
  - `npm run observability:check`
  - `npm run observability:down`
