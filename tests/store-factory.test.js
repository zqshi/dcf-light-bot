const { createStore } = require('../src/infrastructure/persistence/createStore');
const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { AppError } = require('../src/shared/errors');

describe('createStore', () => {
  test('creates file store by default', () => {
    const store = createStore({ storeFile: '/tmp/dcf-factory-test.json' });
    expect(store).toBeInstanceOf(FileStore);
  });

  test('rejects unsupported backend', () => {
    expect(() => createStore({ persistenceBackend: 'unknown', storeFile: '/tmp/a.json' })).toThrow(AppError);
  });
});
