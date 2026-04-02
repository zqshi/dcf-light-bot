/**
 * CategoryConstants — 系统预设分类
 */

const SYSTEM_CATEGORIES = [
  { id: 'cat-official', name: '官方指南', icon: 'verified', type: 'system' },
  { id: 'cat-standard', name: '标准流程', icon: 'account_tree', type: 'system' },
  { id: 'cat-department', name: '部门资产', icon: 'grid_view', type: 'system' },
  { id: 'cat-personal', name: '个人空间', icon: 'person', type: 'system' },
  { id: 'cat-shared', name: '共享空间', icon: 'share', type: 'system' },
];

const SYSTEM_CATEGORY_IDS = new Set(SYSTEM_CATEGORIES.map((c) => c.id));

function isSystemCategory(id) {
  return SYSTEM_CATEGORY_IDS.has(id);
}

module.exports = { SYSTEM_CATEGORIES, SYSTEM_CATEGORY_IDS, isSystemCategory };
