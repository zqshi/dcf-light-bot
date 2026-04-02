const crypto = require('crypto');
const { SYSTEM_CATEGORIES, isSystemCategory } = require('../domain/CategoryConstants');

class CategoryService {
  constructor(repo) {
    this.repo = repo;
  }

  async list() {
    const custom = await this.repo.listCategories();
    return [...SYSTEM_CATEGORIES, ...custom];
  }

  async get(id) {
    const system = SYSTEM_CATEGORIES.find((c) => c.id === id);
    if (system) return system;
    const cat = await this.repo.getCategory(id);
    if (!cat) {
      const err = new Error(`category not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }
    return cat;
  }

  async create(input) {
    const now = new Date().toISOString();
    const category = {
      id: crypto.randomUUID(),
      name: String(input.name || '').trim() || '未命名分类',
      icon: String(input.icon || 'folder').trim(),
      type: String(input.type || 'custom').trim(),
      parentId: String(input.parentId || '').trim() || null,
      departmentId: String(input.departmentId || '').trim() || null,
      description: String(input.description || '').trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.saveCategory(category);
    return category;
  }

  async update(id, input) {
    if (isSystemCategory(id)) {
      const err = new Error('cannot modify system category');
      err.statusCode = 403;
      throw err;
    }
    const existing = await this.get(id);
    const updated = {
      ...existing,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      icon: input.icon !== undefined ? String(input.icon).trim() : existing.icon,
      description: input.description !== undefined ? String(input.description).trim() : existing.description,
      updatedAt: new Date().toISOString(),
    };
    await this.repo.saveCategory(updated);
    return updated;
  }

  async delete(id) {
    if (isSystemCategory(id)) {
      const err = new Error('cannot delete system category');
      err.statusCode = 403;
      throw err;
    }
    return this.repo.deleteCategory(id);
  }
}

module.exports = { CategoryService };
