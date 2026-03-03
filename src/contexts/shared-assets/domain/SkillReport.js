const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');

const ASSET_TYPES = ['skill', 'tool', 'knowledge'];

function normalizeAssetType(input) {
  const value = String(input || 'skill').trim().toLowerCase();
  if (!ASSET_TYPES.includes(value)) return 'skill';
  return value;
}

function createSkillReport(input) {
  return {
    id: newId('skill_report'),
    assetType: normalizeAssetType(input.assetType),
    sourceTenantId: String(input.sourceTenantId || '').trim(),
    sourceInstanceId: String(input.sourceInstanceId || '').trim(),
    sourceSkillId: String(input.sourceSkillId || input.sourceAssetId || '').trim() || null,
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim(),
    contentRef: String(input.contentRef || '').trim() || null,
    tags: Array.isArray(input.tags) ? input.tags.map((x) => String(x).trim()).filter(Boolean) : [],
    version: String(input.version || '1.0.0').trim(),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

module.exports = { ASSET_TYPES, normalizeAssetType, createSkillReport };
