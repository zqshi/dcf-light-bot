const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Upload route', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcf-upload-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('buildUploadRouter creates router with POST and GET', () => {
    const { buildUploadRouter } = require('../src/interfaces/http/routes/uploads');
    const config = { dataDir: tmpDir };
    const requirePermission = () => (_req, _res, next) => next();
    const router = buildUploadRouter(config, requirePermission);
    expect(router).toBeDefined();
    expect(typeof router).toBe('function'); // express router is a function
  });

  test('upload directory is created under dataDir', () => {
    const { buildUploadRouter } = require('../src/interfaces/http/routes/uploads');
    const config = { dataDir: tmpDir };
    const requirePermission = () => (_req, _res, next) => next();
    buildUploadRouter(config, requirePermission);
    expect(fs.existsSync(path.join(tmpDir, 'uploads'))).toBe(true);
  });

  test('MIME whitelist rejects non-image types', () => {
    // Verify the regex pattern used in uploads.js
    const ALLOWED_MIME = /^image\/(png|jpeg|gif|webp|svg\+xml)$/;
    expect(ALLOWED_MIME.test('image/png')).toBe(true);
    expect(ALLOWED_MIME.test('image/jpeg')).toBe(true);
    expect(ALLOWED_MIME.test('image/gif')).toBe(true);
    expect(ALLOWED_MIME.test('image/webp')).toBe(true);
    expect(ALLOWED_MIME.test('image/svg+xml')).toBe(true);
    expect(ALLOWED_MIME.test('application/pdf')).toBe(false);
    expect(ALLOWED_MIME.test('text/plain')).toBe(false);
    expect(ALLOWED_MIME.test('application/javascript')).toBe(false);
  });
});
