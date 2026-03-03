# Production Readiness Checklist

## Security
- [ ] JWT secret configured (`CONTROL_PLANE_JWT_SECRET`)
- [ ] Admin bearer token rotated (`CONTROL_PLANE_ADMIN_TOKEN`)
- [ ] Matrix webhook secret rotated (`MATRIX_WEBHOOK_SECRET`)
- [ ] Control-plane users configured by `CONTROL_PLANE_USERS_JSON` with non-plain passwords
- [ ] No plaintext API keys in repo
- [ ] HTTPS termination enforced at gateway
- [ ] Provider API keys configured in platform env (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY` etc.) and **not** exposed to tenant UI

## Reliability
- [ ] Control-plane data persisted on durable storage
- [ ] Periodic backups configured
- [ ] Reconciler loop enabled and monitored
- [ ] Matrix `!create_agent` load tested for idempotent instance creation

## Observability
- [ ] Audit endpoint retained with export plan
- [ ] Error logs shipped to centralized sink
- [ ] Alerting configured for failed provisioning

## Operations
- [ ] OpenClaw lock commit verified
- [ ] CI green on lint + test + lock verify
- [ ] Runbooks reviewed
- [ ] Asset governance process enabled (`/api/control/assets/*`: report/review/bind)
