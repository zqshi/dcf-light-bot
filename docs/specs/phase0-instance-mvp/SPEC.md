# SPEC: Phase0-1 Instance MVP

## Goal
Build a control-plane-first multi-tenant hosting MVP where Matrix creates one isolated OpenClaw pod instance per digital employee.

## Scope
- Matrix `!create_agent` triggers instance provisioning.
- Platform injects provider API keys from central config.
- Instance state persisted in control-plane store.
- Return a digital employee card with chat URL.
- Asset reports (skill/tool/knowledge) can be submitted from tenant pods to shared registry.
- Shared workflow: report -> approve/reject -> cross-tenant binding.

## Non-Goals
- Full production Kubernetes reconciler.
- Full RBAC UI implementation.
- Real-time websocket stream.

## Acceptance Criteria
1. `POST /api/control/instances` creates instance and returns state `running` in simulation mode.
2. `POST /api/control/skills/reports` accepts pod-origin report and stores it.
3. `POST /api/control/skills/reports/{id}/approve` publishes shared skill.
4. `POST /api/control/skills/bindings` binds shared skill to another tenant.
5. `POST /api/control/assets/reports` supports `assetType` = `skill|tool|knowledge`.
6. `POST /api/control/assets/bindings` binds shared tool/knowledge to another tenant.
7. Matrix bot `!create_agent foo` returns card payload with `chatUrl` and `runtimeEndpoint`.
8. Every critical action emits audit records.
