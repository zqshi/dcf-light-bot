const { canTransition, validateTransition, isValidStatus, VALID_STATUSES, TRANSITIONS } = require('../DocumentLifecycle');

describe('DocumentLifecycle', () => {
  describe('VALID_STATUSES', () => {
    it('contains exactly 4 statuses', () => {
      expect(VALID_STATUSES).toHaveLength(4);
      expect(VALID_STATUSES).toEqual(['draft', 'pending_review', 'published', 'archived']);
    });
  });

  describe('isValidStatus', () => {
    it.each(VALID_STATUSES)('returns true for %s', (s) => {
      expect(isValidStatus(s)).toBe(true);
    });

    it.each(['invalid', '', undefined, null])('returns false for %s', (s) => {
      expect(isValidStatus(s)).toBe(false);
    });
  });

  describe('canTransition', () => {
    const allowed = [
      ['draft', 'pending_review'],
      ['draft', 'published'],
      ['pending_review', 'draft'],
      ['pending_review', 'published'],
      ['published', 'archived'],
      ['published', 'draft'],
      ['archived', 'draft'],
    ];

    it.each(allowed)('%s → %s is allowed', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    const forbidden = [
      ['draft', 'archived'],
      ['pending_review', 'archived'],
      ['archived', 'published'],
      ['archived', 'pending_review'],
      ['published', 'pending_review'],
    ];

    it.each(forbidden)('%s → %s is forbidden', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });

    it('returns false for unknown statuses', () => {
      expect(canTransition('unknown', 'draft')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => validateTransition('draft', 'pending_review')).not.toThrow();
    });

    it('throws with statusCode 400 for invalid transition', () => {
      try {
        validateTransition('draft', 'archived');
        fail('should have thrown');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/invalid status transition/);
      }
    });
  });
});
