class AssetCompatibilityService {
  normalizeVersion(input) {
    const raw = String(input || '').trim();
    const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      raw
    };
  }

  compareVersions(left, right) {
    if (left.major !== right.major) return left.major - right.major;
    if (left.minor !== right.minor) return left.minor - right.minor;
    return left.patch - right.patch;
  }

  ensureByType(rows) {
    const byType = { skill: [], tool: [], knowledge: [] };
    for (const row of rows) {
      const type = String(row.assetType || 'skill');
      if (!byType[type]) byType[type] = [];
      byType[type].push(row);
    }
    return byType;
  }

  validate(runtimeVersion, mountedAssets) {
    const runtime = this.normalizeVersion(runtimeVersion);
    const inputRows = Array.isArray(mountedAssets && mountedAssets.all) ? mountedAssets.all : [];
    const accepted = [];
    const rejected = [];

    for (const row of inputRows) {
      const version = this.normalizeVersion(row.version);
      if (!version) {
        rejected.push({
          assetId: row.assetId,
          name: row.name,
          reason: 'invalid_asset_version'
        });
        continue;
      }

      const minVersionRaw = String(row.minOpenclawVersion || '').trim();
      if (!minVersionRaw) {
        accepted.push(row);
        continue;
      }
      const minVersion = this.normalizeVersion(minVersionRaw);
      if (!minVersion) {
        rejected.push({
          assetId: row.assetId,
          name: row.name,
          reason: 'invalid_min_openclaw_version'
        });
        continue;
      }
      if (runtime && this.compareVersions(runtime, minVersion) >= 0) {
        accepted.push(row);
        continue;
      }
      rejected.push({
        assetId: row.assetId,
        name: row.name,
        reason: 'runtime_version_not_compatible',
        minOpenclawVersion: minVersionRaw,
        runtimeVersion: runtimeVersion || null
      });
    }

    return {
      accepted: { all: accepted, byType: this.ensureByType(accepted) },
      rejected
    };
  }
}

module.exports = { AssetCompatibilityService };
