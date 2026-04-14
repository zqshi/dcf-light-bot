const { AppError } = require('../../shared/errors');
const { FileStore } = require('./FileStore');
const { PostgresStore } = require('./PostgresStore');
const SqliteStore = require('./SqliteStore');

function createStore(config) {
  const backend = String(config.persistenceBackend || 'sqlite').trim().toLowerCase();
  if (backend === 'file') {
    return new FileStore(config.storeFile);
  }
  if (backend === 'sqlite') {
    return new SqliteStore(config.dbFile || config.storeFile);
  }
  if (backend === 'postgres') {
    return new PostgresStore({
      connectionString: config.postgresUrl,
      schema: config.postgresSchema,
      table: config.postgresTable,
      rowKey: config.postgresRowKey
    });
  }
  throw new AppError(`unsupported persistence backend: ${backend}`, 500, 'PERSISTENCE_BACKEND_INVALID');
}

module.exports = { createStore };
