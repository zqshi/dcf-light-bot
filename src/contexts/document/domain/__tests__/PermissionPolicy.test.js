const { hasAtLeast, isValidLevel, canUserAccess, LEVELS } = require('../PermissionPolicy');

describe('PermissionPolicy', () => {
  describe('LEVELS', () => {
    it('contains 4 levels in order', () => {
      expect(LEVELS).toEqual(['admin', 'edit', 'comment', 'view']);
    });
  });

  describe('isValidLevel', () => {
    it.each(LEVELS)('returns true for %s', (l) => {
      expect(isValidLevel(l)).toBe(true);
    });
    it('returns false for unknown level', () => {
      expect(isValidLevel('superadmin')).toBe(false);
    });
  });

  describe('hasAtLeast', () => {
    it('admin >= everything', () => {
      expect(hasAtLeast('admin', 'admin')).toBe(true);
      expect(hasAtLeast('admin', 'view')).toBe(true);
    });

    it('view < edit', () => {
      expect(hasAtLeast('view', 'edit')).toBe(false);
    });

    it('edit >= comment', () => {
      expect(hasAtLeast('edit', 'comment')).toBe(true);
    });

    it('unknown level treated as 0', () => {
      expect(hasAtLeast('unknown', 'view')).toBe(false);
    });
  });

  describe('canUserAccess', () => {
    const perms = [
      { userId: 'alice', level: 'admin' },
      { userId: 'bob', level: 'view' },
    ];

    it('returns true when no permissions set', () => {
      expect(canUserAccess([], 'anyone', 'admin')).toBe(true);
      expect(canUserAccess(null, 'anyone', 'admin')).toBe(true);
    });

    it('admin user can access anything', () => {
      expect(canUserAccess(perms, 'alice', 'admin')).toBe(true);
      expect(canUserAccess(perms, 'alice', 'edit')).toBe(true);
    });

    it('view user cannot edit', () => {
      expect(canUserAccess(perms, 'bob', 'edit')).toBe(false);
    });

    it('view user can view', () => {
      expect(canUserAccess(perms, 'bob', 'view')).toBe(true);
    });

    it('unknown user is denied', () => {
      expect(canUserAccess(perms, 'charlie', 'view')).toBe(false);
    });
  });
});
