const { SYSTEM_CATEGORIES, isSystemCategory } = require('../CategoryConstants');

describe('CategoryConstants', () => {
  it('has 5 system categories', () => {
    expect(SYSTEM_CATEGORIES).toHaveLength(5);
  });

  it('each has id, name, icon, type=system', () => {
    for (const cat of SYSTEM_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.type).toBe('system');
    }
  });

  it('isSystemCategory returns true for known ids', () => {
    expect(isSystemCategory('cat-official')).toBe(true);
    expect(isSystemCategory('cat-shared')).toBe(true);
  });

  it('isSystemCategory returns false for custom ids', () => {
    expect(isSystemCategory('custom-123')).toBe(false);
    expect(isSystemCategory('')).toBe(false);
  });
});
