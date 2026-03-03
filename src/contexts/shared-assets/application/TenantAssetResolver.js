class TenantAssetResolver {
  constructor(repo) {
    this.repo = repo;
  }

  groupByType(assets) {
    const out = { skill: [], tool: [], knowledge: [] };
    for (const row of assets) {
      const type = String(row.assetType || 'skill');
      if (!out[type]) out[type] = [];
      out[type].push(row);
    }
    return out;
  }

  async resolveByTenant(tenantId) {
    const target = String(tenantId || '').trim();
    if (!target) return { all: [], byType: { skill: [], tool: [], knowledge: [] } };
    const bindings = await this.repo.listAssetBindings();
    const ownBindings = bindings.filter((x) => String(x.tenantId || '') === target && String(x.status || 'active') === 'active');
    const allAssets = await this.repo.listSharedAssets();

    const boundAssets = ownBindings
      .map((binding) => {
        const assetId = String(binding.assetId || binding.skillId || '').trim();
        if (!assetId) return null;
        const asset = allAssets.find((x) => String(x.id || '') === assetId);
        if (!asset) return null;
        return {
          bindingId: binding.id,
          assetId: asset.id,
          assetType: String(asset.assetType || 'skill'),
          name: asset.name,
          description: asset.description,
          version: asset.version,
          minOpenclawVersion: String(asset.minOpenclawVersion || '').trim() || null,
          contentRef: asset.contentRef || null,
          tags: Array.isArray(asset.tags) ? asset.tags : []
        };
      })
      .filter(Boolean);

    return {
      all: boundAssets,
      byType: this.groupByType(boundAssets)
    };
  }
}

module.exports = { TenantAssetResolver };
