class ControlPlaneRepository {
  constructor(store) {
    this.store = store;
  }

  async listInstances() {
    const doc = await this.store.read();
    return doc.instances || [];
  }

  async getInstance(instanceId) {
    const rows = await this.listInstances();
    return rows.find((x) => x.id === instanceId) || null;
  }

  async findInstanceByRequestId(requestId) {
    const rows = await this.listInstances();
    return rows.find((x) => String(x.requestId || '') === String(requestId || '')) || null;
  }

  async saveInstance(instance) {
    await this.store.update((doc) => {
      const list = Array.isArray(doc.instances) ? doc.instances : [];
      const idx = list.findIndex((x) => x.id === instance.id);
      if (idx >= 0) list[idx] = instance;
      else list.push(instance);
      return { ...doc, instances: list };
    });
    return instance;
  }

  async appendAudit(event) {
    await this.store.update((doc) => {
      const rows = Array.isArray(doc.audits) ? doc.audits : [];
      rows.unshift(event);
      return { ...doc, audits: rows.slice(0, 5000) };
    });
  }

  async listAudits(limit = 100) {
    const doc = await this.store.read();
    return (doc.audits || []).slice(0, limit);
  }

  async addSkillReport(report) {
    return this.addAssetReport(report);
  }

  async addAssetReport(report) {
    await this.store.update((doc) => {
      const existing = Array.isArray(doc.assetReports) ? doc.assetReports : (Array.isArray(doc.skillReports) ? doc.skillReports : []);
      const rows = [...existing];
      rows.unshift(report);
      return { ...doc, assetReports: rows.slice(0, 10000), skillReports: rows.slice(0, 10000) };
    });
    return report;
  }

  async updateSkillReport(report) {
    return this.updateAssetReport(report);
  }

  async updateAssetReport(report) {
    await this.store.update((doc) => {
      const existing = Array.isArray(doc.assetReports) ? doc.assetReports : (Array.isArray(doc.skillReports) ? doc.skillReports : []);
      const rows = [...existing];
      const idx = rows.findIndex((x) => x.id === report.id);
      if (idx >= 0) rows[idx] = report;
      return { ...doc, assetReports: rows, skillReports: rows };
    });
    return report;
  }

  async getSkillReport(reportId) {
    return this.getAssetReport(reportId);
  }

  async getAssetReport(reportId) {
    const rows = await this.listAssetReports();
    return rows.find((x) => x.id === reportId) || null;
  }

  async listSkillReports() {
    return this.listAssetReports();
  }

  async listAssetReports() {
    const doc = await this.store.read();
    if (Array.isArray(doc.assetReports)) return doc.assetReports;
    return doc.skillReports || [];
  }

  async addSharedSkill(skill) {
    return this.addSharedAsset(skill);
  }

  async addSharedAsset(asset) {
    await this.store.update((doc) => {
      const existing = Array.isArray(doc.assets) ? doc.assets : (Array.isArray(doc.skills) ? doc.skills : []);
      const rows = [...existing];
      const idx = rows.findIndex((x) => x.id === asset.id);
      if (idx >= 0) rows[idx] = asset;
      else rows.unshift(asset);
      return { ...doc, assets: rows, skills: rows };
    });
    return asset;
  }

  async getSharedSkill(skillId) {
    return this.getSharedAsset(skillId);
  }

  async getSharedAsset(assetId) {
    const rows = await this.listSharedAssets();
    return rows.find((x) => x.id === assetId) || null;
  }

  async listSharedAssets(type) {
    const doc = await this.store.read();
    const rows = Array.isArray(doc.assets) ? doc.assets : (doc.skills || []);
    if (!type) return rows;
    return rows.filter((x) => String(x.assetType || 'skill') === String(type));
  }

  async listSharedSkills() {
    return this.listSharedAssets('skill');
  }

  async addAssetBinding(binding) {
    await this.store.update((doc) => {
      const existing = Array.isArray(doc.assetBindings) ? doc.assetBindings : (Array.isArray(doc.skillBindings) ? doc.skillBindings : []);
      const rows = [...existing];
      const idx = rows.findIndex((x) => x.id === binding.id);
      if (idx >= 0) rows[idx] = binding;
      else rows.unshift(binding);
      return { ...doc, assetBindings: rows, skillBindings: rows };
    });
    return binding;
  }

  async findAssetBinding(tenantId, assetId) {
    const rows = await this.listAssetBindings();
    return rows.find((x) => x.tenantId === tenantId && (x.assetId === assetId || x.skillId === assetId)) || null;
  }

  async listAssetBindings(type) {
    const doc = await this.store.read();
    const rows = Array.isArray(doc.assetBindings) ? doc.assetBindings : (doc.skillBindings || []);
    if (!type) return rows;
    return rows.filter((x) => String(x.assetType || 'skill') === String(type));
  }

  async addSkillBinding(binding) {
    const mapped = {
      ...binding,
      assetId: binding.assetId || binding.skillId,
      assetType: binding.assetType || 'skill'
    };
    return this.addAssetBinding(mapped);
  }

  async findSkillBinding(tenantId, skillId) {
    return this.findAssetBinding(tenantId, skillId);
  }

  async listSkillBindings() {
    return this.listAssetBindings('skill');
  }
}

module.exports = { ControlPlaneRepository };
