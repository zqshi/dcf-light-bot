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

  async getProvisioningJobByRequestId(requestId) {
    const key = String(requestId || '').trim();
    if (!key) return null;
    const doc = await this.store.read();
    const rows = Array.isArray(doc.provisioningJobs) ? doc.provisioningJobs : [];
    return rows.find((x) => String(x && x.requestId || '') === key) || null;
  }

  async saveProvisioningJob(job) {
    const key = String(job && job.requestId || '').trim();
    if (!key) return null;
    await this.store.update((doc) => {
      const rows = Array.isArray(doc.provisioningJobs) ? [...doc.provisioningJobs] : [];
      const idx = rows.findIndex((x) => String(x && x.requestId || '') === key);
      if (idx >= 0) rows[idx] = job;
      else rows.unshift(job);
      return { ...doc, provisioningJobs: rows.slice(0, 5000) };
    });
    return job;
  }

  async listProvisioningJobs(limit = 100) {
    const n = Math.max(1, Number(limit || 100));
    const doc = await this.store.read();
    const rows = Array.isArray(doc.provisioningJobs) ? doc.provisioningJobs : [];
    return rows.slice(0, n);
  }

  async deleteInstance(instanceId) {
    const key = String(instanceId || '').trim();
    if (!key) return false;
    let deleted = false;
    await this.store.update((doc) => {
      const list = Array.isArray(doc.instances) ? doc.instances : [];
      const next = list.filter((x) => {
        const keep = String((x && x.id) || '') !== key;
        if (!keep) deleted = true;
        return keep;
      });
      return { ...doc, instances: next };
    });
    return deleted;
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

  async pruneAudits(options = {}) {
    const ttlMs = Math.max(0, Number(options.ttlMs || 0));
    const maxRows = Math.max(0, Number(options.maxRows || 0));
    const archiveEnabled = options.archiveEnabled !== false;
    const archiveMaxRows = Math.max(0, Number(options.archiveMaxRows || 0));
    const now = Date.now();
    let result = {
      before: 0,
      kept: 0,
      archived: 0,
      deleted: 0
    };

    await this.store.update((doc) => {
      const rows = Array.isArray(doc.audits) ? doc.audits : [];
      const archiveRows = Array.isArray(doc.auditArchive) ? doc.auditArchive : [];
      result.before = rows.length;

      const kept = [];
      const pruned = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const ts = Date.parse(String(row && row.at || ''));
        const expired = ttlMs > 0 && Number.isFinite(ts) && (now - ts) > ttlMs;
        const overflow = maxRows > 0 && kept.length >= maxRows;
        if (expired || overflow) pruned.push(row);
        else kept.push(row);
      }

      let nextArchive = archiveRows;
      if (archiveEnabled && pruned.length) {
        nextArchive = [...pruned, ...archiveRows];
        if (archiveMaxRows > 0) nextArchive = nextArchive.slice(0, archiveMaxRows);
      }

      result.kept = kept.length;
      result.archived = archiveEnabled ? Math.min(pruned.length, archiveMaxRows > 0 ? archiveMaxRows : pruned.length) : 0;
      result.deleted = pruned.length - result.archived;

      return {
        ...doc,
        audits: kept,
        auditArchive: nextArchive
      };
    });

    return result;
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

  // ─── Documents ────────────────────────────────────────────────────

  async listDocuments(roomId) {
    const doc = await this.store.read();
    const rows = Array.isArray(doc.documents) ? doc.documents : [];
    if (!roomId) return rows;
    return rows.filter((x) => String(x.roomId || '') === String(roomId));
  }

  async getDocument(id) {
    const rows = await this.listDocuments();
    return rows.find((x) => x.id === id) || null;
  }

  async saveDocument(document) {
    await this.store.update((doc) => {
      const list = Array.isArray(doc.documents) ? doc.documents : [];
      const idx = list.findIndex((x) => x.id === document.id);
      if (idx >= 0) list[idx] = document;
      else list.push(document);
      return { ...doc, documents: list };
    });
    return document;
  }

  async deleteDocument(id) {
    const key = String(id || '').trim();
    if (!key) return false;
    let deleted = false;
    await this.store.update((doc) => {
      const list = Array.isArray(doc.documents) ? doc.documents : [];
      const next = list.filter((x) => {
        const keep = String((x && x.id) || '') !== key;
        if (!keep) deleted = true;
        return keep;
      });
      return { ...doc, documents: next };
    });
    return deleted;
  }

  async getPlatformConfig(key) {
    const name = String(key || '').trim();
    if (!name) return null;
    const doc = await this.store.read();
    const configs = doc && typeof doc.platformConfigs === 'object' && doc.platformConfigs
      ? doc.platformConfigs
      : {};
    return configs[name] || null;
  }

  async setPlatformConfig(key, value) {
    const name = String(key || '').trim();
    if (!name) return null;
    await this.store.update((doc) => {
      const configs = doc && typeof doc.platformConfigs === 'object' && doc.platformConfigs
        ? { ...doc.platformConfigs }
        : {};
      configs[name] = value;
      return { ...doc, platformConfigs: configs };
    });
    return value;
  }
}

module.exports = { ControlPlaneRepository };
