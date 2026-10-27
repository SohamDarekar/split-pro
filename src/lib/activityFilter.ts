import { SplitType } from '@prisma/client';

import { CATEGORIES, type CategorySection } from '~/lib/category';
import { CURRENCIES, isCurrencyCode } from '~/lib/currency';

export type ActivityKind = 'all' | 'expenses' | 'settlements' | 'deleted';

export interface ActivityFilters {
  search: string;
  kind: ActivityKind;
  category: CategorySection | '';
  paidBy: number | null;
  groupId: number | null;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = {
  search: '',
  kind: 'all',
  category: '',
  paidBy: null,
  groupId: null,
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
};

export interface ActivityEntry {
  amount: bigint;
  expense: {
    name: string;
    category: string;
    amount: bigint;
    currency: string;
    splitType: SplitType;
    expenseDate: Date;
    paidBy: number;
    groupId: number | null;
    deletedBy: number | null;
    paidByUser: { name: string | null; email: string | null };
    group?: { name: string } | null;
  };
}

export const countActiveFilters = (filters: ActivityFilters) =>
  [
    '' !== filters.search.trim(),
    'all' !== filters.kind,
    '' !== filters.category,
    null !== filters.paidBy,
    null !== filters.groupId,
    '' !== filters.dateFrom,
    '' !== filters.dateTo,
    '' !== filters.amountMin.trim(),
    '' !== filters.amountMax.trim(),
  ].filter(Boolean).length;

export const getCategorySection = (category: string): CategorySection | undefined =>
  (Object.keys(CATEGORIES) as CategorySection[]).find(
    (section) =>
      section === category || (CATEGORIES[section] as readonly string[]).includes(category),
  );

const toMajorUnits = (amount: bigint, currency: string) => {
  const digits = isCurrencyCode(currency) ? CURRENCIES[currency].decimalDigits : 2;
  return Math.abs(Number(amount)) / 10 ** digits;
};

const parseAmount = (value: string) => {
  const parsed = Number.parseFloat(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

// Date inputs are local calendar days; compare by local day boundaries
const startOfDay = (value: string) => new Date(`${value}T00:00:00`);
const endOfDay = (value: string) => new Date(`${value}T23:59:59.999`);

export const filterActivity = <T extends ActivityEntry>(
  entries: T[],
  filters: ActivityFilters,
): T[] => {
  const search = filters.search.trim().toLowerCase();
  const min = parseAmount(filters.amountMin);
  const max = parseAmount(filters.amountMax);
  const from = filters.dateFrom ? startOfDay(filters.dateFrom) : null;
  const to = filters.dateTo ? endOfDay(filters.dateTo) : null;

  return entries.filter(({ expense }) => {
    const isSettlement = SplitType.SETTLEMENT === expense.splitType;
    const isDeleted = null !== expense.deletedBy;

    if ('deleted' === filters.kind && !isDeleted) {
      return false;
    }
    if ('settlements' === filters.kind && (!isSettlement || isDeleted)) {
      return false;
    }
    if ('expenses' === filters.kind && (isSettlement || isDeleted)) {
      return false;
    }

    if ('' !== filters.category && getCategorySection(expense.category) !== filters.category) {
      return false;
    }
    if (null !== filters.paidBy && expense.paidBy !== filters.paidBy) {
      return false;
    }
    if (null !== filters.groupId && expense.groupId !== filters.groupId) {
      return false;
    }
    if (from && expense.expenseDate < from) {
      return false;
    }
    if (to && expense.expenseDate > to) {
      return false;
    }

    const majorAmount = toMajorUnits(expense.amount, expense.currency);
    if (null !== min && majorAmount < min) {
      return false;
    }
    if (null !== max && majorAmount > max) {
      return false;
    }

    if ('' === search) {
      return true;
    }

    return [expense.name, expense.paidByUser.name, expense.paidByUser.email, expense.group?.name]
      .filter((value): value is string => !!value)
      .some((value) => value.toLowerCase().includes(search));
  });
};
