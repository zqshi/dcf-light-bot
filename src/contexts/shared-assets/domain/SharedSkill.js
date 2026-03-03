const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');
const { normalizeAssetType } = require('./SkillReport');

function createSharedSkillFromReport(report, actor) {
  const now = nowIso();
  return {
    id: newId('shared_skill'),
    assetType: normalizeAssetType(report.assetType),
    sourceReportId: report.id,
    sourceTenantId: report.sourceTenantId,
    sourceInstanceId: report.sourceInstanceId,
    name: report.name,
    description: report.description,
    contentRef: report.contentRef,
    tags: report.tags || [],
    version: report.version,
    status: 'active',
    publishedBy: actor,
    publishedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function createSkillBinding(tenantId, skillId, actor) {
  const now = nowIso();
  return {
    id: newId('skill_binding'),
    tenantId,
    skillId,
    assetType: 'skill',
    status: 'active',
    createdBy: actor,
    createdAt: now,
    updatedAt: now
  };
}

function createAssetBinding(tenantId, assetId, assetType, actor) {
  const now = nowIso();
  return {
    id: newId('asset_binding'),
    tenantId,
    assetId,
    assetType: normalizeAssetType(assetType),
    status: 'active',
    createdBy: actor,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = { createSharedSkillFromReport, createSkillBinding, createAssetBinding };
