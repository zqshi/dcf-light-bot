const { AssetCompatibilityService } = require('../src/contexts/shared-assets/application/AssetCompatibilityService');

describe('AssetCompatibilityService', () => {
  test('rejects incompatible min openclaw version while keeping compatible assets', () => {
    const svc = new AssetCompatibilityService();
    const out = svc.validate('2026.2.27', {
      all: [
        { assetId: 'a1', assetType: 'tool', name: 'ok-tool', version: '1.0.0', minOpenclawVersion: '2026.1.1' },
        { assetId: 'a2', assetType: 'knowledge', name: 'future-kb', version: '1.0.0', minOpenclawVersion: '2027.1.0' }
      ]
    });
    expect(out.accepted.all).toHaveLength(1);
    expect(out.accepted.all[0].assetId).toBe('a1');
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0].assetId).toBe('a2');
  });

  test('rejects invalid asset version', () => {
    const svc = new AssetCompatibilityService();
    const out = svc.validate('2026.2.27', {
      all: [
        { assetId: 'a1', assetType: 'skill', name: 'bad', version: 'latest' }
      ]
    });
    expect(out.accepted.all).toHaveLength(0);
    expect(out.rejected[0].reason).toBe('invalid_asset_version');
  });
});
