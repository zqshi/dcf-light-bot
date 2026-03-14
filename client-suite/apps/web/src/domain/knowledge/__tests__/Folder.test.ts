import { describe, it, expect } from 'vitest';
import { Folder } from '../Folder';

describe('Folder', () => {
  it('creates a root folder with defaults', () => {
    const folder = Folder.create({
      id: 'f-1',
      name: '产品文档',
      parentId: null,
      icon: 'inventory_2',
    });
    expect(folder.id).toBe('f-1');
    expect(folder.isRoot).toBe(true);
    expect(folder.hasChildren).toBe(false);
    expect(folder.documentCount).toBe(0);
  });

  it('creates a child folder', () => {
    const folder = Folder.create({
      id: 'f-2',
      name: 'API 文档',
      parentId: 'f-1',
      icon: 'code',
      documentCount: 3,
    });
    expect(folder.isRoot).toBe(false);
    expect(folder.parentId).toBe('f-1');
    expect(folder.documentCount).toBe(3);
  });

  it('supports nested children', () => {
    const child = Folder.create({
      id: 'f-child',
      name: '子目录',
      parentId: 'f-root',
      icon: 'folder',
    });
    const root = Folder.create({
      id: 'f-root',
      name: '根目录',
      parentId: null,
      icon: 'folder',
      children: [child],
    });
    expect(root.hasChildren).toBe(true);
    expect(root.children[0].id).toBe('f-child');
  });

  it('replaces children immutably', () => {
    const folder = Folder.create({
      id: 'f-1',
      name: '文档',
      parentId: null,
      icon: 'folder',
    });
    const newChild = Folder.create({
      id: 'f-new',
      name: '新增',
      parentId: 'f-1',
      icon: 'folder',
    });
    const updated = folder.withChildren([newChild]);
    expect(updated.hasChildren).toBe(true);
    expect(folder.hasChildren).toBe(false);
  });

  it('matches search query', () => {
    const folder = Folder.create({
      id: 'f-1',
      name: '技术文档',
      parentId: null,
      icon: 'code',
    });
    expect(folder.matchesSearch('技术')).toBe(true);
    expect(folder.matchesSearch('设计')).toBe(false);
    expect(folder.matchesSearch('')).toBe(true);
  });
});
