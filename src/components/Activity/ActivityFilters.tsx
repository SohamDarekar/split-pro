import { ChevronDown, SearchIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import React, { useCallback, useState } from 'react';

import {
  type ActivityFilters as ActivityFiltersValue,
  type ActivityKind,
  EMPTY_ACTIVITY_FILTERS,
  countActiveFilters,
} from '~/lib/activityFilter';
import { CATEGORIES, type CategorySection } from '~/lib/category';
import { cn } from '~/lib/utils';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';

interface ActivityFiltersProps {
  filters: ActivityFiltersValue;
  onChange: (filters: ActivityFiltersValue) => void;
  people: { id: number; label: string }[];
  groups: { id: number; label: string }[];
}

const KINDS = ['all', 'expenses', 'settlements', 'deleted'] as const satisfies ActivityKind[];

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <Label className="text-xs text-gray-400">{label}</Label>
    {children}
  </div>
);

export const ActivityFilters: React.FC<ActivityFiltersProps> = ({
  filters,
  onChange,
  people,
  groups,
}) => {
  const { t } = useTranslation();
  const { t: tCategories } = useTranslation('categories');
  const [open, setOpen] = useState(false);

  const activeCount = countActiveFilters(filters);
  const update = useCallback(
    (patch: Partial<ActivityFiltersValue>) => onChange({ ...filters, ...patch }),
    [filters, onChange],
  );

  const onSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => update({ search: e.target.value }),
    [update],
  );
  const onClearSearch = useCallback(() => update({ search: '' }), [update]);
  const onToggle = useCallback(() => setOpen((value) => !value), []);
  const onClear = useCallback(() => onChange(EMPTY_ACTIVITY_FILTERS), [onChange]);

  const onKind = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => update({ kind: e.target.value as ActivityKind }),
    [update],
  );
  const onCategory = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      update({ category: e.target.value as CategorySection | '' }),
    [update],
  );
  const onPaidBy = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      update({ paidBy: '' === e.target.value ? null : Number(e.target.value) }),
    [update],
  );
  const onGroup = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      update({ groupId: '' === e.target.value ? null : Number(e.target.value) }),
    [update],
  );
  const onDateFrom = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => update({ dateFrom: e.target.value }),
    [update],
  );
  const onDateTo = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => update({ dateTo: e.target.value }),
    [update],
  );
  const onAmountMin = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => update({ amountMin: e.target.value }),
    [update],
  );
  const onAmountMax = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => update({ amountMax: e.target.value }),
    [update],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={filters.search}
            onChange={onSearch}
            placeholder={t('activity_filters.search_placeholder')}
            className="pl-9"
            rightIcon={
              '' !== filters.search ? (
                <button type="button" onClick={onClearSearch} aria-label={t('actions.clear')}>
                  <XIcon className="size-4 text-gray-400" />
                </button>
              ) : null
            }
          />
        </div>
        <Button variant="outline" className="h-12 gap-1.5" onClick={onToggle}>
          {t('activity_filters.filters')}
          {0 < activeCount ? (
            <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </Button>
      </div>

      {open ? (
        <div className="grid grid-cols-2 gap-3 rounded-xl border p-3">
          <Field label={t('activity_filters.kind')}>
            <NativeSelect value={filters.kind} onChange={onKind} className="w-full">
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`activity_filters.kind_${kind}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('activity_filters.category')}>
            <NativeSelect value={filters.category} onChange={onCategory} className="w-full">
              <option value="">{t('activity_filters.any')}</option>
              {(Object.keys(CATEGORIES) as CategorySection[]).map((section) => (
                <option key={section} value={section}>
                  {tCategories(`categories_list.${section}.name`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('activity_filters.paid_by')}>
            <NativeSelect value={filters.paidBy ?? ''} onChange={onPaidBy} className="w-full">
              <option value="">{t('activity_filters.any')}</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('activity_filters.group')}>
            <NativeSelect value={filters.groupId ?? ''} onChange={onGroup} className="w-full">
              <option value="">{t('activity_filters.any')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('activity_filters.from')}>
            <Input type="date" value={filters.dateFrom} onChange={onDateFrom} />
          </Field>
          <Field label={t('activity_filters.to')}>
            <Input type="date" value={filters.dateTo} onChange={onDateTo} />
          </Field>
          <Field label={t('activity_filters.min_amount')}>
            <Input
              inputMode="decimal"
              value={filters.amountMin}
              onChange={onAmountMin}
              placeholder="0"
            />
          </Field>
          <Field label={t('activity_filters.max_amount')}>
            <Input inputMode="decimal" value={filters.amountMax} onChange={onAmountMax} />
          </Field>
          {0 < activeCount ? (
            <Button variant="ghost" className="col-span-2" onClick={onClear}>
              {t('activity_filters.clear')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
