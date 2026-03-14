import { describe, it, expect } from 'vitest';
import { Document } from '../Document';

const baseProps = {
  id: 'doc-1',
  title: '产品需求文档',
  content: '<p>这是一份产品需求文档</p>',
  folderId: 'folder-1',
  type: 'doc' as const,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-05T14:30:00Z',
  author: { name: '张三' },
};

describe('Document', () => {
  it('creates with required props and defaults', () => {
    const doc = Document.create(baseProps);
    expect(doc.id).toBe('doc-1');
    expect(doc.title).toBe('产品需求文档');
    expect(doc.type).toBe('doc');
    expect(doc.tags).toEqual([]);
    expect(doc.starred).toBe(false);
    expect(doc.size).toBe('0 KB');
  });

  it('creates with optional props', () => {
    const doc = Document.create({
      ...baseProps,
      tags: ['PRD', 'Q3'],
      starred: true,
      size: '24 KB',
    });
    expect(doc.tags).toEqual(['PRD', 'Q3']);
    expect(doc.starred).toBe(true);
    expect(doc.size).toBe('24 KB');
  });

  it('returns excerpt from HTML content', () => {
    const doc = Document.create(baseProps);
    expect(doc.excerpt).toBe('这是一份产品需求文档');
  });

  it('updates content immutably', () => {
    const doc = Document.create(baseProps);
    const updated = doc.withContent('新内容');
    expect(updated.content).toBe('新内容');
    expect(doc.content).toBe('<p>这是一份产品需求文档</p>');
  });

  it('toggles starred immutably', () => {
    const doc = Document.create(baseProps);
    const starred = doc.withStarred(true);
    expect(starred.starred).toBe(true);
    expect(doc.starred).toBe(false);
  });

  it('matches search by title and tags', () => {
    const doc = Document.create({ ...baseProps, tags: ['PRD'] });
    expect(doc.matchesSearch('产品')).toBe(true);
    expect(doc.matchesSearch('prd')).toBe(true);
    expect(doc.matchesSearch('设计')).toBe(false);
    expect(doc.matchesSearch('')).toBe(true);
  });
});
