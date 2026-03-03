# PLAN: Phase0-1 Instance MVP

## Architecture
- DDD bounded contexts: tenant-instance, shared-assets, audit-observability.
- Infrastructure adapters: persistence(file), k8s provisioner(simulation-first), matrix integration.
- HTTP as interface adapter only.

## Technical Decisions
- Use file-backed control-plane store as bootstrap persistence.
- Keep OpenClaw runtime orchestration as thin as possible.
- Keep each source file under 1000 lines.

## Risks
- Simulation mode may hide real K8s edge cases.
- File persistence has single-node limitation.

## Mitigations
- Encapsulate provisioner interface for real K8s implementation in next phase.
- Replace repository backend with Postgres without changing usecase layer.
