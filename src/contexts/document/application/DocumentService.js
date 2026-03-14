const crypto = require('crypto');

const VALID_TYPES = ['doc', 'code', 'markdown', 'sheet', 'slide'];

class DocumentService {
  constructor(repo, auditService) {
    this.repo = repo;
    this.auditService = auditService || null;
  }

  async audit(type, payload = {}) {
    if (!this.auditService || typeof this.auditService.log !== 'function') return;
    await this.auditService.log(type, payload);
  }

  async list(roomId, { folderId } = {}) {
    const docs = await this.repo.listDocuments(roomId || undefined);
    if (folderId) {
      return docs.filter((d) => {
        const meta = d.content && typeof d.content === 'object' ? d.content._meta : null;
        return meta && meta.folderId === folderId;
      });
    }
    return docs;
  }

  async get(id) {
    const doc = await this.repo.getDocument(id);
    if (!doc) {
      const err = new Error(`document not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }
    return doc;
  }

  async create(input) {
    const type = String(input.type || 'doc').trim();
    if (!VALID_TYPES.includes(type)) {
      const err = new Error(`invalid document type: ${type}. allowed: ${VALID_TYPES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    const now = new Date().toISOString();
    const rawContent = input.content && typeof input.content === 'object' ? input.content : {};
    const meta = rawContent._meta && typeof rawContent._meta === 'object' ? { ...rawContent._meta } : {};
    if (input.folderId !== undefined) meta.folderId = String(input.folderId || '').trim() || null;
    if (input.tags !== undefined) meta.tags = Array.isArray(input.tags) ? input.tags.map(String) : [];
    if (input.starred !== undefined) meta.starred = Boolean(input.starred);
    const content = { ...rawContent, _meta: meta };
    const doc = {
      id: crypto.randomUUID(),
      roomId: String(input.roomId || '').trim() || null,
      type,
      title: String(input.title || '').trim() || '未命名文档',
      content,
      createdBy: String(input.createdBy || '').trim() || 'system',
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    await this.repo.saveDocument(doc);
    await this.audit('document.created', { documentId: doc.id, type, roomId: doc.roomId, createdBy: doc.createdBy });
    return doc;
  }

  async update(id, input) {
    const existing = await this.get(id);

    // Optimistic locking
    if (input.version !== undefined && Number(input.version) !== existing.version) {
      const err = new Error(`version conflict: expected ${existing.version}, got ${input.version}`);
      err.statusCode = 409;
      throw err;
    }

    let content = input.content !== undefined ? input.content : existing.content;
    if (typeof content !== 'object' || content === null) content = {};
    const existingMeta = existing.content && typeof existing.content === 'object' && existing.content._meta ? existing.content._meta : {};
    const newMeta = content._meta && typeof content._meta === 'object' ? content._meta : existingMeta;
    const mergedMeta = { ...existingMeta, ...newMeta };
    if (input.folderId !== undefined) mergedMeta.folderId = String(input.folderId || '').trim() || null;
    if (input.tags !== undefined) mergedMeta.tags = Array.isArray(input.tags) ? input.tags.map(String) : [];
    if (input.starred !== undefined) mergedMeta.starred = Boolean(input.starred);
    content = { ...content, _meta: mergedMeta };
    const updated = {
      ...existing,
      title: input.title !== undefined ? String(input.title).trim() : existing.title,
      content,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1
    };
    await this.repo.saveDocument(updated);
    await this.audit('document.updated', { documentId: id, version: updated.version });
    return updated;
  }

  async delete(id) {
    await this.get(id); // ensure exists
    const deleted = await this.repo.deleteDocument(id);
    if (deleted) {
      await this.audit('document.deleted', { documentId: id });
    }
    return deleted;
  }

  async toggleStar(id) {
    const existing = await this.get(id);
    const meta = existing.content && typeof existing.content === 'object' && existing.content._meta
      ? existing.content._meta : {};
    const starred = !Boolean(meta.starred);
    const content = { ...existing.content, _meta: { ...meta, starred } };
    const updated = {
      ...existing,
      content,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1
    };
    await this.repo.saveDocument(updated);
    await this.audit('document.starred', { documentId: id, starred });
    return updated;
  }
}

module.exports = { DocumentService };
