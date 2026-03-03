const { PostgresStore } = require('../src/infrastructure/persistence/PostgresStore');

class FakeClient {
  constructor(fakePool) {
    this.fakePool = fakePool;
  }

  async query(sql, params = []) {
    this.fakePool.calls.push({ sql: String(sql), params, via: 'client' });
    if (/SELECT doc .* FOR UPDATE/i.test(sql)) {
      if (this.fakePool.doc === null) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ doc: this.fakePool.doc }] };
    }
    if (/INSERT INTO[\s\S]*ON CONFLICT/i.test(sql)) {
      this.fakePool.doc = JSON.parse(params[1]);
      return { rowCount: 1, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  }

  release() {
    this.fakePool.released += 1;
  }
}

class FakePool {
  constructor() {
    this.doc = null;
    this.calls = [];
    this.released = 0;
    this.ended = false;
  }

  async query(sql, params = []) {
    this.calls.push({ sql: String(sql), params, via: 'pool' });
    if (/SELECT doc FROM/i.test(sql) && !/FOR UPDATE/i.test(sql)) {
      if (this.doc === null) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ doc: this.doc }] };
    }
    if (/INSERT INTO .*DO NOTHING/i.test(sql) && this.doc === null) {
      this.doc = JSON.parse(params[1]);
    }
    return { rowCount: 0, rows: [] };
  }

  async connect() {
    return new FakeClient(this);
  }

  async end() {
    this.ended = true;
  }
}

describe('PostgresStore', () => {
  test('supports read and transactional update using pool abstraction', async () => {
    const fakePool = new FakePool();
    const store = new PostgresStore({
      connectionString: 'postgres://local/test',
      poolFactory: () => fakePool
    });

    const initial = await store.read();
    expect(initial.instances).toEqual([]);

    await store.update(async (doc) => {
      const next = { ...doc, instances: [{ id: 'i1' }] };
      return next;
    });

    const out = await store.read();
    expect(out.instances).toHaveLength(1);
    expect(out.instances[0].id).toBe('i1');

    await store.close();
    expect(fakePool.ended).toBe(true);
  });
});
