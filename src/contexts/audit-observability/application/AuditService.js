const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');
const { getRequestContext } = require('../../../shared/requestContext');

class AuditService {
  constructor(repo) {
    this.repo = repo;
  }

  normalizeTime(input) {
    if (!input) return null;
    const ts = Date.parse(String(input));
    if (!Number.isFinite(ts)) return null;
    return ts;
  }

  matchesFilters(event, filters = {}) {
    const type = String(filters.type || '').trim();
    const actor = String(filters.actor || '').trim();
    const tenantId = String(filters.tenantId || '').trim();
    const fromTs = this.normalizeTime(filters.from);
    const toTs = this.normalizeTime(filters.to);
    const atTs = this.normalizeTime(event.at);

    if (type && String(event.type || '') !== type) return false;
    if (actor) {
      const eventActor = String((event.actor && event.actor.username) || '').trim();
      if (eventActor !== actor) return false;
    }
    if (tenantId) {
      const p = event.payload && typeof event.payload === 'object' ? event.payload : {};
      const eventTenantId = String(p.tenantId || '').trim();
      if (eventTenantId !== tenantId) return false;
    }
    if (fromTs && atTs && atTs < fromTs) return false;
    if (toTs && atTs && atTs > toTs) return false;
    return true;
  }

  async log(type, payload, metadata = {}) {
    const reqCtx = getRequestContext();
    const meta = metadata && typeof metadata === 'object' ? metadata : {};
    const actor = meta.actor || reqCtx.actor || null;
    const event = {
      id: newId('audit'),
      type,
      payload: payload && typeof payload === 'object' ? payload : {},
      at: nowIso(),
      requestId: String(meta.requestId || reqCtx.requestId || ''),
      traceId: String(meta.traceId || reqCtx.traceId || ''),
      correlationId: String(meta.correlationId || reqCtx.correlationId || ''),
      actor: actor && typeof actor === 'object'
        ? {
            username: String(actor.username || ''),
            role: String(actor.role || '')
          }
        : null,
      context: meta.context && typeof meta.context === 'object' ? meta.context : {}
    };
    await this.repo.appendAudit(event);
    return event;
  }

  async list(limit = 100, filters = {}) {
    const effectiveLimit = Math.max(1, Math.min(5000, Number(limit || 100)));
    const rows = await this.repo.listAudits(5000);
    const filtered = rows.filter((event) => this.matchesFilters(event, filters));
    return filtered.slice(0, effectiveLimit);
  }

  toNdjson(events) {
    return events.map((event) => JSON.stringify(event)).join('\n');
  }

  async export(limit = 1000, filters = {}, format = 'json') {
    const rows = await this.list(limit, filters);
    const targetFormat = String(format || 'json').trim().toLowerCase();
    if (targetFormat === 'ndjson') {
      return {
        contentType: 'application/x-ndjson; charset=utf-8',
        body: this.toNdjson(rows)
      };
    }
    return {
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ success: true, data: rows, total: rows.length }, null, 2)
    };
  }
}

module.exports = { AuditService };
