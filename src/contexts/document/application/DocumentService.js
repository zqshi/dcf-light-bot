const crypto = require('crypto');
const { validateTransition } = require('../domain/DocumentLifecycle');

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

  async knowledgeAudit(operationType, operatorId, operatorName, targetId, targetName, extra = {}) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      operationType,
      operatorId: String(operatorId || 'system'),
      operatorName: String(operatorName || 'System'),
      targetId: String(targetId || ''),
      targetName: String(targetName || ''),
      ...extra,
    };
    await this.repo.appendKnowledgeAudit(entry);
    return entry;
  }

  async list(roomId, { folderId, status, categoryId, departmentId, ownerId, starred, search } = {}) {
    let docs = await this.repo.listDocuments(roomId || undefined);
    if (folderId) {
      docs = docs.filter((d) => {
        const meta = d.content && typeof d.content === 'object' ? d.content._meta : null;
        return (meta && meta.folderId === folderId) || d.categoryId === folderId;
      });
    }
    if (status) docs = docs.filter((d) => d.status === status);
    if (categoryId) docs = docs.filter((d) => d.categoryId === categoryId);
    if (departmentId) docs = docs.filter((d) => d.departmentId === departmentId);
    if (ownerId) docs = docs.filter((d) => d.ownerId === ownerId || d.createdBy === ownerId);
    if (starred !== undefined) {
      const s = Boolean(starred);
      docs = docs.filter((d) => {
        const meta = d.content && typeof d.content === 'object' ? d.content._meta : {};
        return Boolean(meta.starred) === s;
      });
    }
    if (search) {
      const q = String(search).toLowerCase();
      docs = docs.filter((d) => (d.title || '').toLowerCase().includes(q));
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
      status: String(input.status || 'draft'),
      categoryId: String(input.categoryId || '').trim() || null,
      departmentId: String(input.departmentId || '').trim() || null,
      ownerId: String(input.ownerId || input.createdBy || '').trim() || 'system',
      permissions: Array.isArray(input.permissions) ? input.permissions : [],
      createdBy: String(input.createdBy || '').trim() || 'system',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await this.repo.saveDocument(doc);
    await this._saveVersionSnapshot(doc, 'auto');
    await this.audit('document.created', { documentId: doc.id, type, roomId: doc.roomId, createdBy: doc.createdBy });
    await this.knowledgeAudit('create', doc.ownerId, doc.createdBy, doc.id, doc.title);
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
      categoryId: input.categoryId !== undefined ? String(input.categoryId).trim() : existing.categoryId,
      departmentId: input.departmentId !== undefined ? String(input.departmentId).trim() : existing.departmentId,
      permissions: input.permissions !== undefined ? input.permissions : existing.permissions,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    await this.repo.saveDocument(updated);
    await this._saveVersionSnapshot(updated, 'auto');
    await this.audit('document.updated', { documentId: id, version: updated.version });
    await this.knowledgeAudit('edit', updated.ownerId, updated.createdBy, id, updated.title);
    return updated;
  }

  async delete(id) {
    const doc = await this.get(id);
    const deleted = await this.repo.deleteDocument(id);
    if (deleted) {
      await this.audit('document.deleted', { documentId: id });
      await this.knowledgeAudit('delete', doc.ownerId, doc.createdBy, id, doc.title);
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
      version: existing.version + 1,
    };
    await this.repo.saveDocument(updated);
    await this.audit('document.starred', { documentId: id, starred });
    return updated;
  }

  // ─── Lifecycle Methods ──────────────────────────────────────────

  async transitionStatus(id, targetStatus, actor = {}) {
    const existing = await this.get(id);
    const currentStatus = existing.status || 'draft';
    validateTransition(currentStatus, targetStatus);

    const updated = {
      ...existing,
      status: targetStatus,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };

    if (targetStatus === 'published') {
      updated.publishedAt = new Date().toISOString();
      updated.reviewedBy = actor.name || null;
    }
    if (targetStatus === 'pending_review') {
      updated.submittedAt = new Date().toISOString();
    }

    await this.repo.saveDocument(updated);
    if (targetStatus === 'published') {
      await this._saveVersionSnapshot(updated, 'published');
    }
    await this.audit(`document.${targetStatus}`, { documentId: id });
    await this.knowledgeAudit(targetStatus === 'published' ? 'publish' : targetStatus === 'archived' ? 'archive' : targetStatus, actor.id || 'system', actor.name || 'System', id, updated.title);
    return updated;
  }

  async submitForReview(id, actor = {}) {
    return this.transitionStatus(id, 'pending_review', actor);
  }

  async approve(id, actor = {}) {
    return this.transitionStatus(id, 'published', actor);
  }

  async reject(id, comment, actor = {}) {
    const existing = await this.get(id);
    const updated = await this.transitionStatus(id, 'draft', actor);
    updated.reviewComment = String(comment || '');
    await this.repo.saveDocument(updated);
    return updated;
  }

  async publish(id, actor = {}) {
    return this.transitionStatus(id, 'published', actor);
  }

  async archive(id, actor = {}) {
    return this.transitionStatus(id, 'archived', actor);
  }

  // ─── Versions ───────────────────────────────────────────────────

  async listVersions(documentId) {
    return this.repo.listVersions(documentId);
  }

  async restoreVersion(versionId) {
    const version = await this.repo.getVersion(versionId);
    if (!version) {
      const err = new Error(`version not found: ${versionId}`);
      err.statusCode = 404;
      throw err;
    }
    if (!version.contentSnapshot) {
      const err = new Error('version has no content snapshot');
      err.statusCode = 400;
      throw err;
    }
    const doc = await this.get(version.documentId);
    const restored = {
      ...doc,
      content: typeof version.contentSnapshot === 'string' ? { html: version.contentSnapshot } : version.contentSnapshot,
      updatedAt: new Date().toISOString(),
      version: doc.version + 1,
    };
    await this.repo.saveDocument(restored);
    await this._saveVersionSnapshot(restored, 'manual');
    await this.knowledgeAudit('restore', doc.ownerId, doc.createdBy, doc.id, `${doc.title} (v${version.versionNumber})`);
    return restored;
  }

  async _saveVersionSnapshot(doc, status = 'auto') {
    const htmlContent = doc.content && typeof doc.content === 'object' ? (doc.content.html || '') : '';
    const version = {
      id: crypto.randomUUID(),
      documentId: doc.id,
      versionNumber: doc.version,
      title: doc.title,
      editedBy: doc.ownerId || doc.createdBy || 'system',
      createdAt: new Date().toISOString(),
      contentSnapshot: htmlContent,
      status,
    };
    await this.repo.saveVersion(version);
    return version;
  }

  // ─── Permissions ────────────────────────────────────────────────

  async getPermissions(documentId) {
    return this.repo.listDocumentPermissions(documentId);
  }

  async updatePermissions(documentId, permissions) {
    await this.get(documentId); // ensure exists
    await this.repo.saveDocumentPermissions(documentId, permissions);
    await this.knowledgeAudit('permission', 'system', 'System', documentId, `updated ${permissions.length} rules`);
    return permissions;
  }
}

module.exports = { DocumentService };
