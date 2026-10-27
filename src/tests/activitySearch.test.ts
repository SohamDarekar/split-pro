import { type ActivityEntry, searchActivity } from '~/lib/activitySearch';

const makeEntry = (overrides: Partial<ActivityEntry['expense']> = {}): ActivityEntry => ({
  expense: {
    name: 'Dinner',
    paidByUser: { name: 'Alice', email: 'alice@test.com' },
    group: null,
    ...overrides,
  },
});

describe('searchActivity', () => {
  describe('Matching', () => {
    it('should match expense name case-insensitively', () => {
      const entries = [makeEntry({ name: 'Dinner' }), makeEntry({ name: 'Rent' })];
      const result = searchActivity(entries, 'dIN');
      expect(result).toHaveLength(1);
      expect(result[0]?.expense.name).toBe('Dinner');
    });

    it('should match payer name, email and group name', () => {
      const entries = [
        makeEntry({ paidByUser: { name: 'Bob', email: 'bob@x.com' } }),
        makeEntry({ group: { name: 'Trip' } }),
      ];
      expect(searchActivity(entries, 'bob@')).toHaveLength(1);
      expect(searchActivity(entries, 'trip')).toHaveLength(1);
      expect(searchActivity(entries, 'alice')).toHaveLength(1);
    });

    it('should return nothing when no field matches', () => {
      expect(searchActivity([makeEntry()], 'zzz')).toHaveLength(0);
    });
  });

  describe('Empty query', () => {
    it('should return every entry for empty or whitespace-only queries', () => {
      const entries = [makeEntry(), makeEntry({ name: 'Rent' })];
      expect(searchActivity(entries, '')).toHaveLength(2);
      expect(searchActivity(entries, '   ')).toHaveLength(2);
    });

    it('should ignore surrounding whitespace', () => {
      expect(searchActivity([makeEntry()], '  din ')).toHaveLength(1);
    });
  });
});
