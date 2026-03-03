const { AppError } = require('../../shared/errors');

function assertIdentifier(input, label) {
  const value = String(input || '').trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new AppError(`${label} is invalid`, 500, 'POSTGRES_IDENTIFIER_INVALID');
  }
  return value;
}

function defaultPoolFactory(connectionString) {
  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch (error) {
    throw new AppError(`pg is required for postgres backend: ${error.message}`, 500, 'POSTGRES_DRIVER_MISSING');
  }
  return new Pool({ connectionString });
}

class PostgresStore {
  constructor(options) {
    const input = options || {};
    this.connectionString = String(input.connectionString || '').trim();
    this.schema = assertIdentifier(input.schema || 'public', 'postgres schema');
    this.table = assertIdentifier(input.table || 'control_plane_store', 'postgres table');
    this.rowKey = String(input.rowKey || 'main').trim();
    if (!this.connectionString) {
      throw new AppError('postgres connection string is required', 500, 'POSTGRES_URL_REQUIRED');
    }
    const poolFactory = typeof input.poolFactory === 'function' ? input.poolFactory : defaultPoolFactory;
    this.pool = poolFactory(this.connectionString);
  }

  tableRef() {
    return `"${this.schema}"."${this.table}"`;
  }

  async init() {
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableRef()} (
        id TEXT PRIMARY KEY,
        doc JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(
      `INSERT INTO ${this.tableRef()} (id, doc) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`,
      [this.rowKey, JSON.stringify(this.defaultDoc())]
    );
  }

  defaultDoc() {
    return {
      instances: [],
      assetReports: [],
      assets: [],
      assetBindings: [],
      audits: []
    };
  }

  async read() {
    await this.init();
    const out = await this.pool.query(`SELECT doc FROM ${this.tableRef()} WHERE id = $1`, [this.rowKey]);
    if (!out.rowCount) return this.defaultDoc();
    return out.rows[0].doc || this.defaultDoc();
  }

  async update(mutator) {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(`SELECT doc FROM ${this.tableRef()} WHERE id = $1 FOR UPDATE`, [this.rowKey]);
      const doc = current.rowCount ? (current.rows[0].doc || this.defaultDoc()) : this.defaultDoc();
      const next = await mutator(doc);
      await client.query(
        `INSERT INTO ${this.tableRef()} (id, doc, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = NOW()`,
        [this.rowKey, JSON.stringify(next || this.defaultDoc())]
      );
      await client.query('COMMIT');
      return next;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool && typeof this.pool.end === 'function') {
      await this.pool.end();
    }
  }
}

module.exports = { PostgresStore };
