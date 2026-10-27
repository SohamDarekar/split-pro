import { SplitType } from '@prisma/client';

import {
  type ActivityEntry,
  EMPTY_ACTIVITY_FILTERS,
  countActiveFilters,
  filterActivity,
  getCategorySection,
} from '~/lib/activityFilter';

const makeEntry = (overrides: Partial<ActivityEntry['expense']> = {}): ActivityEntry => ({
  amount: 0n,
  expense: {
    name: 'Dinner',
    category: 'diningOut',
    amount: 5000n,
    currency: 'AUD',
    splitType: SplitType.EQUAL,
    expenseDate: new Date('2026-10-10T12:00:00'),
    paidBy: 1,
    groupId: null,
    deletedBy: null,
    paidByUser: { name: 'Alice', email: 'alice@test.com' },
    group: null,
    ...overrides,
  },
});

describe('filterActivity', () => {
  describe('Search', () => {
    it('should match expense name case-insensitively', () => {
      const entries = [makeEntry({ name: 'Dinner' }), makeEntry({ name: 'Rent' })];
      const result = filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, search: 'dIN' });
      expect(result).toHaveLength(1);
      expect(result[0]?.expense.name).toBe('Dinner');
    });

    it('should match payer name, email and group name', () => {
      const entries = [
        makeEntry({ paidByUser: { name: 'Bob', email: 'bob@x.com' } }),
        makeEntry({ group: { name: 'Trip' } }),
      ];
      expect(filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, search: 'bob@' })).toHaveLength(
        1,
      );
      expect(filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, search: 'trip' })).toHaveLength(
        1,
      );
    });

    it('should ignore surrounding whitespace', () => {
      const result = filterActivity([makeEntry()], { ...EMPTY_ACTIVITY_FILTERS, search: '  din ' });
      expect(result).toHaveLength(1);
    });
  });

  describe('Kind', () => {
    const entries = [
      makeEntry({ name: 'normal' }),
      makeEntry({ name: 'settle', splitType: SplitType.SETTLEMENT }),
      makeEntry({ name: 'gone', deletedBy: 2 }),
    ];

    it('should keep everything for all', () => {
      expect(filterActivity(entries, EMPTY_ACTIVITY_FILTERS)).toHaveLength(3);
    });

    it('should split expenses, settlements and deleted', () => {
      const names = (kind: 'expenses' | 'settlements' | 'deleted') =>
        filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, kind }).map((e) => e.expense.name);
      expect(names('expenses')).toEqual(['normal']);
      expect(names('settlements')).toEqual(['settle']);
      expect(names('deleted')).toEqual(['gone']);
    });
  });

  describe('Category', () => {
    it('should resolve items and sections to their section', () => {
      expect(getCategorySection('diningOut')).toBe('food');
      expect(getCategorySection('food')).toBe('food');
      expect(getCategorySection('general')).toBe('general');
      expect(getCategorySection('nonsense')).toBeUndefined();
    });

    it('should filter by section', () => {
      const entries = [makeEntry({ category: 'groceries' }), makeEntry({ category: 'rent' })];
      const result = filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, category: 'food' });
      expect(result).toHaveLength(1);
      expect(result[0]?.expense.category).toBe('groceries');
    });
  });

  describe('People and groups', () => {
    it('should filter by payer and group', () => {
      const entries = [
        makeEntry({ paidBy: 1, groupId: 10 }),
        makeEntry({ paidBy: 2, groupId: 10 }),
        makeEntry({ paidBy: 2, groupId: null }),
      ];
      expect(filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, paidBy: 2 })).toHaveLength(2);
      expect(filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, groupId: 10 })).toHaveLength(2);
      expect(
        filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, paidBy: 2, groupId: 10 }),
      ).toHaveLength(1);
    });
  });

  describe('Date range', () => {
    const entries = [
      makeEntry({ expenseDate: new Date('2026-10-01T09:00:00') }),
      makeEntry({ expenseDate: new Date('2026-10-15T23:30:00') }),
      makeEntry({ expenseDate: new Date('2026-10-31T00:00:00') }),
    ];

    it('should include both boundary days', () => {
      const result = filterActivity(entries, {
        ...EMPTY_ACTIVITY_FILTERS,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-15',
      });
      expect(result).toHaveLength(2);
    });

    it('should support open-ended ranges', () => {
      expect(
        filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, dateFrom: '2026-10-16' }),
      ).toHaveLength(1);
      expect(
        filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, dateTo: '2026-10-01' }),
      ).toHaveLength(1);
    });
  });

  describe('Amount range', () => {
    const entries = [
      makeEntry({ amount: 1000n }),
      makeEntry({ amount: -2500n }),
      makeEntry({ amount: 10000n }),
    ];

    it('should compare absolute amounts in major units', () => {
      const result = filterActivity(entries, {
        ...EMPTY_ACTIVITY_FILTERS,
        amountMin: '20',
        amountMax: '50',
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.expense.amount).toBe(-2500n);
    });

    it('should accept comma decimals and ignore garbage', () => {
      expect(
        filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, amountMin: '9,5', amountMax: '10,5' }),
      ).toHaveLength(1);
      expect(filterActivity(entries, { ...EMPTY_ACTIVITY_FILTERS, amountMin: 'abc' })).toHaveLength(
        3,
      );
    });

    it('should fall back to two decimals for unknown currencies', () => {
      const result = filterActivity([makeEntry({ amount: 50000n, currency: 'XXX' })], {
        ...EMPTY_ACTIVITY_FILTERS,
        amountMin: '400',
        amountMax: '600',
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('countActiveFilters', () => {
    it('should count only non-default filters', () => {
      expect(countActiveFilters(EMPTY_ACTIVITY_FILTERS)).toBe(0);
      expect(
        countActiveFilters({ ...EMPTY_ACTIVITY_FILTERS, search: ' ', kind: 'deleted', paidBy: 3 }),
      ).toBe(2);
    });
  });
});
