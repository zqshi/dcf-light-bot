const { createStore } = require('../src/infrastructure/persistence/createStore');
const SqliteStore = require('../src/infrastructure/persistence/SqliteStore');
const { AppError } = require('../src/shared/errors');

describe('createStore', () => {
  test('creates sqlite store by default', () => {
    const store = createStore({ storeFile: '/tmp/dcf-factory-test.json' });
    expect(store).toBeInstanceOf(SqliteStore);
  });

  test('rejects unsupported backend', () => {
    expect(() => createStore({ persistenceBackend: 'unknown', storeFile: '/tmp/a.json' })).toThrow(AppError);
  });
});
