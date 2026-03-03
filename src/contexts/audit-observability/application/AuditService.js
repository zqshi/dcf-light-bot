const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');
const { getRequestContext } = require('../../../shared/requestContext');

class AuditService {
  constructor(repo, options = {}) {
    this.repo = repo;
    this.retention = {
      ttlDays: Math.max(0, Number(options.retentionTtlDays || 0)),
      maxRows: Math.max(0, Number(options.retentionMaxRows || 0)),
      archiveEnabled: options.archiveEnabled !== false,
      archiveMaxRows: Math.max(0, Number(options.archiveMaxRows || 0))
    };
  }

  normalizeTime(input) {
    if (!input) return null;
    const ts = Date.parse(String(input));
    if (!Number.isFinite(ts)) return null;
    return ts;
  }

  normalizeCursor(input) {
    const raw = String(input || '').trim();
    if (!raw) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  encodeCursor(offset) {
    return String(Math.max(0, Math.floor(Number(offset || 0))));
  }

  applyIncrementalFilters(rows, filters = {}) {
    const sinceId = String(filters.sinceId || '').trim();
    const sinceAtTs = this.normalizeTime(filters.sinceAt);
    const untilAtTs = this.normalizeTime(filters.untilAt);
    let out = Array.isArray(rows) ? rows.slice() : [];

    if (sinceId) {
      const idx = out.findIndex((x) => String(x.id || '') === sinceId);
      if (idx >= 0) out = out.slice(0, idx);
    }
    if (sinceAtTs) {
      out = out.filter((x) => {
        const ts = this.normalizeTime(x.at);
        return !ts || ts >= sinceAtTs;
      });
    }
    if (untilAtTs) {
      out = out.filter((x) => {
        const ts = this.normalizeTime(x.at);
        return !ts || ts <= untilAtTs;
      });
    }

    return out;
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

  async queryPage(limit = 100, filters = {}, cursor = 0) {
    const effectiveLimit = Math.max(1, Math.min(5000, Number(limit || 100)));
    const offset = this.normalizeCursor(cursor);
    const rows = await this.repo.listAudits(5000);
    const incremental = this.applyIncrementalFilters(rows, filters);
    const filtered = incremental.filter((event) => this.matchesFilters(event, filters));
    const page = filtered.slice(offset, offset + effectiveLimit);
    const nextOffset = offset + page.length;
    const hasMore = nextOffset < filtered.length;
    return {
      rows: page,
      total: filtered.length,
      cursor: this.encodeCursor(offset),
      nextCursor: hasMore ? this.encodeCursor(nextOffset) : null,
      hasMore
    };
  }

  async list(limit = 100, filters = {}) {
    const page = await this.queryPage(limit, filters, 0);
    return page.rows;
  }

  toNdjson(events) {
    return events.map((event) => JSON.stringify(event)).join('\n');
  }

  async export(limit = 1000, filters = {}, format = 'json', cursor = 0) {
    const page = await this.queryPage(limit, filters, cursor);
    const rows = page.rows;
    const targetFormat = String(format || 'json').trim().toLowerCase();
    if (targetFormat === 'ndjson') {
      return {
        contentType: 'application/x-ndjson; charset=utf-8',
        body: this.toNdjson(rows),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        total: page.total
      };
    }
    return {
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        success: true,
        data: rows,
        total: page.total,
        cursor: page.cursor,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore
      }, null, 2),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total
    };
  }

  async pruneRetention(trigger = 'manual') {
    const ttlDays = this.retention.ttlDays;
    const ttlMs = ttlDays > 0 ? ttlDays * 24 * 3600 * 1000 : 0;
    const stats = await this.repo.pruneAudits({
      ttlMs,
      maxRows: this.retention.maxRows,
      archiveEnabled: this.retention.archiveEnabled,
      archiveMaxRows: this.retention.archiveMaxRows
    });

    await this.log('audit.retention.pruned', {
      trigger,
      ttlDays,
      maxRows: this.retention.maxRows,
      archiveEnabled: this.retention.archiveEnabled,
      archiveMaxRows: this.retention.archiveMaxRows,
      before: stats.before,
      kept: stats.kept,
      archived: stats.archived,
      deleted: stats.deleted
    });
    return stats;
  }
}

module.exports = { AuditService };
