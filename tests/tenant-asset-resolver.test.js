const { TenantAssetResolver } = require('../src/contexts/shared-assets/application/TenantAssetResolver');

describe('TenantAssetResolver', () => {
  test('resolves active bound assets for tenant and groups by type', async () => {
    const repo = {
      listAssetBindings: async () => [
        { id: 'b1', tenantId: 't1', assetId: 'a1', assetType: 'tool', status: 'active' },
        { id: 'b2', tenantId: 't1', assetId: 'a2', assetType: 'knowledge', status: 'active' },
        { id: 'b3', tenantId: 't1', assetId: 'a3', assetType: 'skill', status: 'disabled' },
        { id: 'b4', tenantId: 't2', assetId: 'a1', assetType: 'tool', status: 'active' }
      ],
      listSharedAssets: async () => [
        { id: 'a1', assetType: 'tool', name: 'doc-reader', version: '1.0.0', description: '' },
        { id: 'a2', assetType: 'knowledge', name: 'hr-policy', version: '2.0.0', description: '' },
        { id: 'a3', assetType: 'skill', name: 'qa-reviewer', version: '1.1.0', description: '' }
      ]
    };
    const resolver = new TenantAssetResolver(repo);

    const out = await resolver.resolveByTenant('t1');
    expect(out.all).toHaveLength(2);
    expect(out.byType.tool).toHaveLength(1);
    expect(out.byType.knowledge).toHaveLength(1);
    expect(out.byType.skill).toHaveLength(0);
  });
});
