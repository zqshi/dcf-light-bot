# Runbook: Instance Lifecycle

## Create Instance
1. Matrix command `!create_agent <name>` or POST `/api/control/instances`.
2. Include `Authorization: Bearer <CONTROL_PLANE_ADMIN_TOKEN>` for control API.
3. Check audit entry `instance.requested` then `instance.provisioned`.
4. Validate returned card has `chatUrl`.

## Matrix Webhook
1. Call `POST /api/integrations/matrix/commands`.
2. Include header `x-matrix-webhook-secret`.
3. Body: `{ sender, roomId, text }`.

## Stop Instance
1. POST `/api/control/instances/{id}/stop` with admin bearer.
2. Confirm state becomes `stopped`.

## Start Instance
1. POST `/api/control/instances/{id}/start` with admin bearer.
2. Confirm state becomes `running`.
