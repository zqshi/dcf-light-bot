# Runbook: Release

## Pre-Release Checklist
1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run verify:openclaw-lock`
5. Validate `.env` production secrets:
   - `CONTROL_PLANE_ADMIN_TOKEN`
   - `MATRIX_WEBHOOK_SECRET`
   - at least one provider API key
6. Validate persistence backend:
   - `PERSISTENCE_BACKEND=file` with writable `CONTROL_PLANE_STORE`, or
   - `PERSISTENCE_BACKEND=postgres` with valid `POSTGRES_URL`
7. If `postgres`, run migration [001_control_plane_store.sql](/Users/zqs/Downloads/project/dcf-light-bot/scripts/migrations/001_control_plane_store.sql).
8. Confirm reconcile flags:
   - `KUBERNETES_RECONCILE_ENABLED=true`
   - `KUBERNETES_ROLLBACK_ON_PROVISION_FAILURE=true`

## Release Steps
1. Update `versions.lock.json` if OpenClaw dependency changed.
2. Tag and push.
3. Deploy control plane.
4. Run smoke checks:
   - `GET /health`
   - `GET /status`
   - create instance via matrix webhook

## Rollback
1. Redeploy previous tag.
2. Verify `versions.lock.json` still matches dependency commit.
3. Replay failed operations from audit log if needed.
