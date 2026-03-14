const { DocumentService } = require('../src/contexts/document/application/DocumentService');

function makeRepo() {
  const docs = [];
  return {
    listDocuments(roomId) {
      if (!roomId) return docs;
      return docs.filter((d) => d.roomId === roomId);
    },
    getDocument(id) {
      return docs.find((d) => d.id === id) || null;
    },
    saveDocument(doc) {
      const idx = docs.findIndex((d) => d.id === doc.id);
      if (idx >= 0) docs[idx] = doc;
      else docs.push(doc);
      return doc;
    },
    deleteDocument(id) {
      const idx = docs.findIndex((d) => d.id === id);
      if (idx < 0) return false;
      docs.splice(idx, 1);
      return true;
    },
    _docs: docs,
  };
}

function makeAudit() {
  const logs = [];
  return { log: async (type, payload) => logs.push({ _type: type, ...payload }), _logs: logs };
}

describe('DocumentService', () => {
  test('CRUD lifecycle', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const svc = new DocumentService(repo, audit);

    // create
    const doc = await svc.create({ title: '测试文档', type: 'doc', roomId: 'room1', content: { html: '<p>hi</p>' }, createdBy: 'alice' });
    expect(doc.id).toBeTruthy();
    expect(doc.title).toBe('测试文档');
    expect(doc.version).toBe(1);
    expect(doc.roomId).toBe('room1');
    expect(doc.content.html).toBe('<p>hi</p>');

    // list
    const all = await svc.list();
    expect(all).toHaveLength(1);

    // list by roomId
    const filtered = await svc.list('room1');
    expect(filtered).toHaveLength(1);
    const empty = await svc.list('room_other');
    expect(empty).toHaveLength(0);

    // get
    const fetched = await svc.get(doc.id);
    expect(fetched.title).toBe('测试文档');

    // update
    const updated = await svc.update(doc.id, { title: '新标题', content: { html: '<p>updated</p>' }, version: 1 });
    expect(updated.version).toBe(2);
    expect(updated.title).toBe('新标题');
    expect(updated.content.html).toBe('<p>updated</p>');

    // delete
    const deleted = await svc.delete(doc.id);
    expect(deleted).toBe(true);
    const afterDelete = await svc.list();
    expect(afterDelete).toHaveLength(0);

    // audit trail
    expect(audit._logs.some((l) => l._type === 'document.created')).toBe(true);
    expect(audit._logs.some((l) => l._type === 'document.updated')).toBe(true);
    expect(audit._logs.some((l) => l._type === 'document.deleted')).toBe(true);
  });

  test('version conflict returns 409', async () => {
    const repo = makeRepo();
    const svc = new DocumentService(repo);

    const doc = await svc.create({ title: 'v-test', type: 'doc', content: {} });
    await expect(svc.update(doc.id, { title: 'x', version: 999 }))
      .rejects
      .toThrow(/version conflict/);
    try {
      await svc.update(doc.id, { title: 'x', version: 999 });
    } catch (e) {
      expect(e.statusCode).toBe(409);
    }
  });

  test('get non-existent returns 404', async () => {
    const repo = makeRepo();
    const svc = new DocumentService(repo);

    await expect(svc.get('nonexistent')).rejects.toThrow(/not found/);
    try {
      await svc.get('nonexistent');
    } catch (e) {
      expect(e.statusCode).toBe(404);
    }
  });

  test('invalid type returns 400', async () => {
    const repo = makeRepo();
    const svc = new DocumentService(repo);

    await expect(svc.create({ title: 'bad', type: 'spreadsheet', content: {} }))
      .rejects
      .toThrow(/invalid document type/);
    try {
      await svc.create({ title: 'bad', type: 'spreadsheet', content: {} });
    } catch (e) {
      expect(e.statusCode).toBe(400);
    }
  });

  test('default title when empty', async () => {
    const repo = makeRepo();
    const svc = new DocumentService(repo);

    const doc = await svc.create({ type: 'doc', content: {} });
    expect(doc.title).toBe('未命名文档');
  });
});
