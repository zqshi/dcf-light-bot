const { AppError } = require('../../shared/errors');
const { FileStore } = require('./FileStore');
const { PostgresStore } = require('./PostgresStore');

function createStore(config) {
  const backend = String(config.persistenceBackend || 'file').trim().toLowerCase();
  if (backend === 'file') {
    return new FileStore(config.storeFile);
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
