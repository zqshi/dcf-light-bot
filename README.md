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

## Persistence Backend
- `PERSISTENCE_BACKEND=file` (default): local JSON file store.
- `PERSISTENCE_BACKEND=postgres`: use Postgres as control-plane store backend.
- When using Postgres, set `POSTGRES_URL` and run migration SQL in [001_control_plane_store.sql](/Users/zqs/Downloads/project/dcf-light-bot/scripts/migrations/001_control_plane_store.sql).

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

## Quality Gates
```bash
npm run lint
npm test
npm run verify:openclaw-lock
```
