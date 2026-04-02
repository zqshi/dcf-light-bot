const { DocumentService } = require('../DocumentService');

function makeMockRepo() {
  const docs = new Map();
  const versions = [];
  const auditLog = [];
  const permissions = new Map();

  return {
    docs, versions, auditLog, permissions,

    async listDocuments() { return [...docs.values()]; },
    async getDocument(id) { return docs.get(id) || null; },
    async saveDocument(doc) { docs.set(doc.id, { ...doc }); },
    async deleteDocument(id) {
      if (!docs.has(id)) return false;
      docs.delete(id);
      return true;
    },
    async saveVersion(v) { versions.push(v); },
    async listVersions(docId) { return versions.filter((v) => v.documentId === docId); },
    async getVersion(vId) { return versions.find((v) => v.id === vId) || null; },
    async appendKnowledgeAudit(entry) { auditLog.push(entry); },
    async listDocumentPermissions(docId) { return permissions.get(docId) || []; },
    async saveDocumentPermissions(docId, perms) { permissions.set(docId, perms); },
  };
}

function makeMockAudit() {
  const entries = [];
  return {
    entries,
    async log(type, payload) { entries.push({ type, ...payload }); },
  };
}

describe('DocumentService', () => {
  let service, repo, audit;

  beforeEach(() => {
    repo = makeMockRepo();
    audit = makeMockAudit();
    service = new DocumentService(repo, audit);
  });

  describe('create', () => {
    it('creates a document with default status draft', async () => {
      const doc = await service.create({ title: 'Test', type: 'doc' });
      expect(doc.id).toBeDefined();
      expect(doc.status).toBe('draft');
      expect(doc.version).toBe(1);
      expect(doc.title).toBe('Test');
    });

    it('rejects invalid type', async () => {
      await expect(service.create({ title: 'X', type: 'invalid' }))
        .rejects.toThrow(/invalid document type/);
    });

    it('saves a version snapshot on create', async () => {
      const doc = await service.create({ title: 'V', type: 'doc' });
      expect(repo.versions).toHaveLength(1);
      expect(repo.versions[0].documentId).toBe(doc.id);
    });

    it('writes knowledge audit entry', async () => {
      await service.create({ title: 'Audit', type: 'doc' });
      expect(repo.auditLog).toHaveLength(1);
      expect(repo.auditLog[0].operationType).toBe('create');
    });
  });

  describe('get', () => {
    it('returns document by id', async () => {
      const doc = await service.create({ title: 'Find me', type: 'doc' });
      const found = await service.get(doc.id);
      expect(found.title).toBe('Find me');
    });

    it('throws 404 for missing doc', async () => {
      try {
        await service.get('nonexistent');
        fail('should throw');
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  describe('update', () => {
    it('updates title and bumps version', async () => {
      const doc = await service.create({ title: 'Old', type: 'doc' });
      const updated = await service.update(doc.id, { title: 'New' });
      expect(updated.title).toBe('New');
      expect(updated.version).toBe(2);
    });

    it('rejects version conflict', async () => {
      const doc = await service.create({ title: 'X', type: 'doc' });
      try {
        await service.update(doc.id, { title: 'Y', version: 999 });
        fail('should throw');
      } catch (err) {
        expect(err.statusCode).toBe(409);
      }
    });
  });

  describe('lifecycle', () => {
    let docId;

    beforeEach(async () => {
      const doc = await service.create({ title: 'Lifecycle Doc', type: 'doc' });
      docId = doc.id;
    });

    it('submit for review: draft → pending_review', async () => {
      const result = await service.submitForReview(docId, { id: 'u1', name: 'Alice' });
      expect(result.status).toBe('pending_review');
    });

    it('approve: pending_review → published', async () => {
      await service.submitForReview(docId);
      const result = await service.approve(docId, { name: 'Admin' });
      expect(result.status).toBe('published');
      expect(result.reviewedBy).toBe('Admin');
    });

    it('reject: pending_review → draft with comment', async () => {
      await service.submitForReview(docId);
      const result = await service.reject(docId, '不符合标准');
      expect(result.status).toBe('draft');
      expect(result.reviewComment).toBe('不符合标准');
    });

    it('publish directly: draft → published', async () => {
      const result = await service.publish(docId);
      expect(result.status).toBe('published');
    });

    it('archive: published → archived', async () => {
      await service.publish(docId);
      const result = await service.archive(docId);
      expect(result.status).toBe('archived');
    });

    it('invalid transition throws 400', async () => {
      // draft → archived is not allowed
      try {
        await service.transitionStatus(docId, 'archived');
        fail('should throw');
      } catch (err) {
        expect(err.statusCode).toBe(400);
      }
    });

    it('publish creates a version with status=published', async () => {
      const versionsBefore = repo.versions.length;
      await service.publish(docId);
      const versionsAfter = repo.versions.filter((v) => v.status === 'published');
      expect(versionsAfter.length).toBeGreaterThan(0);
    });
  });

  describe('versions', () => {
    it('listVersions returns versions for a document', async () => {
      const doc = await service.create({ title: 'V', type: 'doc' });
      const versions = await service.listVersions(doc.id);
      expect(versions.length).toBeGreaterThanOrEqual(1);
    });

    it('restoreVersion restores content', async () => {
      const doc = await service.create({ title: 'Original', type: 'doc', content: { html: '<p>v1</p>' } });
      await service.update(doc.id, { content: { html: '<p>v2</p>' } });
      const versions = await service.listVersions(doc.id);
      const v1 = versions[0]; // first version
      const restored = await service.restoreVersion(v1.id);
      expect(restored.version).toBe(3);
    });

    it('restoreVersion throws 404 for missing version', async () => {
      try {
        await service.restoreVersion('nonexistent');
        fail('should throw');
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  describe('permissions', () => {
    it('updatePermissions stores and returns permissions', async () => {
      const doc = await service.create({ title: 'P', type: 'doc' });
      const perms = [{ userId: 'u1', level: 'edit' }];
      const result = await service.updatePermissions(doc.id, perms);
      expect(result).toEqual(perms);
      const stored = await service.getPermissions(doc.id);
      expect(stored).toEqual(perms);
    });
  });

  describe('list filtering', () => {
    beforeEach(async () => {
      await service.create({ title: 'Doc A', type: 'doc', status: 'draft', categoryId: 'cat-1' });
      const b = await service.create({ title: 'Doc B', type: 'doc', categoryId: 'cat-2' });
      await service.publish(b.id);
    });

    it('filters by status', async () => {
      const published = await service.list(null, { status: 'published' });
      expect(published).toHaveLength(1);
      expect(published[0].title).toBe('Doc B');
    });

    it('filters by categoryId', async () => {
      const cat1 = await service.list(null, { categoryId: 'cat-1' });
      expect(cat1).toHaveLength(1);
    });

    it('filters by search keyword', async () => {
      const result = await service.list(null, { search: 'doc a' });
      expect(result).toHaveLength(1);
    });
  });
});
