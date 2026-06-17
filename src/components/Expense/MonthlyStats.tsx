'use client';

import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '~/lib/utils';
import { getCurrencyHelpers } from '~/utils/numbers';
import { isCurrencyCode } from '~/lib/currency';

// ── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = [
  '#06b6d4',
  '#a855f7',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#3b82f6',
  '#fb923c',
  '#84cc16',
];

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍔',
  travel: '✈️',
  entertainment: '🎬',
  home: '🏠',
  utilities: '⚡',
  life: '💊',
  general: '📦',
};

// ── Static style constants (avoids jsx-no-new-object-as-prop) ────────────────

const TOOLTIP_STYLE = {
  background: 'hsl(224 71.4% 8%)',
  border: '1px solid hsl(215 27.9% 16.9%)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 12,
} as const;

const HERO_CARD_STYLE = {
  background:
    'linear-gradient(135deg, hsl(224 71% 8%) 0%, hsl(215 40% 14%) 50%, hsl(189 50% 12%) 100%)',
  border: '1px solid hsl(215 27.9% 16.9%)',
} as const;

const DARK_CARD_STYLE = {
  background: 'hsl(224 71% 6%)',
  border: '1px solid hsl(215 27.9% 16.9%)',
} as const;

const BIGGEST_CARD_STYLE = {
  background: 'linear-gradient(135deg, hsl(280 60% 10%), hsl(224 71% 6%))',
  border: '1px solid hsl(280 30% 20%)',
} as const;

const GLOW_STYLE = { textShadow: '0 0 30px rgba(6,182,212,0.4)' } as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CurrencyAmount {
  currency: string;
  amount: bigint;
}

interface MonthlyStatsProps {
  personal?: CurrencyAmount[];
  group?: CurrencyAmount[];
  byCategory?: { category: string; totals: CurrencyAmount[] }[];
  byGroup?: { groupId: number; name: string; totals: CurrencyAmount[] }[];
  biggestExpense?: { name: string; currency: string; amount: bigint } | null;
  expenseCount?: number;
  daysActive?: number;
  youPaidTotal?: CurrencyAmount[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmt(amount: bigint, currency: string): string {
  if (!isCurrencyCode(currency)) return String(Number(amount) / 100);
  return getCurrencyHelpers({ currency }).toUIString(amount);
}

function tooltipFormatter(value: unknown) {
  return [`${Number(value).toFixed(1)}%`] as [string];
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  color?: string;
  className?: string;
}> = ({ label, value, sub, color = '#06b6d4', className }) => {
  const colorStyle = useMemo(() => ({ color }), [color]);
  return (
    <div className={cn('flex flex-col gap-1 rounded-2xl p-4', className)}>
      <p className="text-xs font-medium tracking-widest text-white/50 uppercase">{label}</p>
      <p className="text-2xl font-bold text-white" style={colorStyle}>
        {value}
      </p>
      {sub && <p className="text-xs text-white/60">{sub}</p>}
    </div>
  );
};

const DonutChart: React.FC<{
  data: { name: string; value: number; color: string }[];
  label?: string;
}> = ({ data, label }) => (
  <div className="relative flex h-44 items-center justify-center">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={72}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
      </PieChart>
    </ResponsiveContainer>
    {label && (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs text-white/50">by share</p>
        <p className="text-sm font-semibold text-white">{label}</p>
      </div>
    )}
  </div>
);

const CategoryLegendItem: React.FC<{
  name: string;
  color: string;
  pct: number;
  amount: string;
}> = ({ name, color, pct, amount }) => {
  const barStyle = useMemo(() => ({ width: `${pct}%`, background: color }), [pct, color]);
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{CATEGORY_EMOJI[name] ?? '📦'}</span>
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <span className="text-white/80 capitalize">{name}</span>
          <span className="text-white/50">{amount}</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-700" style={barStyle} />
        </div>
      </div>
    </div>
  );
};

const CategoryLegend: React.FC<{
  items: { name: string; color: string; value: number; amount: string }[];
}> = ({ items }) => (
  <div className="mt-2 flex flex-col gap-2">
    {items.map((item) => (
      <CategoryLegendItem
        key={item.name}
        name={item.name}
        color={item.color}
        pct={item.value}
        amount={item.amount}
      />
    ))}
  </div>
);

const GroupBar: React.FC<{
  name: string;
  amount: string;
  pct: number;
  color: string;
}> = ({ name, amount, pct, color }) => {
  const dotStyle = useMemo(() => ({ background: color }), [color]);
  const barStyle = useMemo(() => ({ width: `${pct}%`, background: color }), [pct, color]);
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-28 items-center gap-1.5">
        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={dotStyle} />
        <p className="truncate text-xs text-white/80">{name}</p>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={barStyle}
          />
        </div>
        <p className="w-20 text-right text-xs text-white/60">{amount}</p>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const MonthlyStats: React.FC<MonthlyStatsProps> = ({
  personal = [],
  group = [],
  byCategory = [],
  byGroup = [],
  biggestExpense,
  expenseCount = 0,
  daysActive = 0,
  youPaidTotal = [],
}) => {
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();

  const hasAny = personal.length > 0 || group.length > 0;
  if (!hasAny) return null;

  const allTotals = [...personal, ...group];
  const currencyFreq = allTotals.reduce<Record<string, number>>((acc, { currency }) => {
    acc[currency] = (acc[currency] ?? 0) + 1;
    return acc;
  }, {});
  const dominantCurrency =
    Object.entries(currencyFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'USD';

  const personalAmt = personal.find((p) => p.currency === dominantCurrency);
  const groupAmt = group.find((g) => g.currency === dominantCurrency);
  const totalAmt = (personalAmt?.amount ?? 0n) + (groupAmt?.amount ?? 0n);

  const catData = useMemo(() => {
    const filtered = byCategory
      .map((c) => ({
        name: c.category,
        raw: c.totals.find((t) => t.currency === dominantCurrency)?.amount ?? 0n,
      }))
      .filter((c) => c.raw > 0n)
      .sort((a, b) => (a.raw > b.raw ? -1 : 1));

    const total = filtered.reduce((s, c) => s + c.raw, 0n);
    if (total === 0n) return [];

    return filtered.map((c, i) => ({
      name: c.name,
      value: Number((c.raw * 10000n) / total) / 100,
      color: PALETTE[i % PALETTE.length]!,
      amount: formatAmt(c.raw, dominantCurrency),
    }));
  }, [byCategory, dominantCurrency]);

  const topCategory = catData[0];

  const groupData = useMemo(() => {
    const filtered = byGroup
      .map((g) => ({
        name: g.name,
        raw: g.totals.find((t) => t.currency === dominantCurrency)?.amount ?? 0n,
      }))
      .filter((g) => g.raw > 0n)
      .sort((a, b) => (a.raw > b.raw ? -1 : 1));

    const max = filtered[0]?.raw ?? 1n;
    return filtered.map((g, i) => ({
      name: g.name,
      pct: Number((g.raw * 100n) / max),
      color: PALETTE[(i + 2) % PALETTE.length]!,
      amount: formatAmt(g.raw, dominantCurrency),
    }));
  }, [byGroup, dominantCurrency]);

  const youPaid = youPaidTotal.find((p) => p.currency === dominantCurrency);
  const paidMoreThanOwed = youPaid && personalAmt && youPaid.amount > personalAmt.amount;

  return (
    <div className="mx-4 mt-6">
      {/* Header */}
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-foreground text-xl font-bold">
            {monthName} {year}
          </p>
          <p className="text-muted-foreground text-sm">your month in spending</p>
        </div>
        <div className="flex gap-3 text-right">
          <div>
            <p className="text-muted-foreground text-xs">expenses</p>
            <p className="text-foreground text-lg font-bold">{expenseCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">active days</p>
            <p className="text-foreground text-lg font-bold">{daysActive}</p>
          </div>
        </div>
      </div>

      {/* Total spent hero card */}
      <div className="mb-4 overflow-hidden rounded-3xl p-5" style={HERO_CARD_STYLE}>
        <p className="text-xs font-medium tracking-widest text-white/50 uppercase">
          total you spent
        </p>
        <p className="mt-1 text-4xl font-black tracking-tight text-white" style={GLOW_STYLE}>
          {formatAmt(totalAmt, dominantCurrency)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {personalAmt && (
            <StatCard
              label="Personal"
              value={formatAmt(personalAmt.amount, dominantCurrency)}
              color="#06b6d4"
              className="bg-white/5"
            />
          )}
          {groupAmt && (
            <StatCard
              label="With groups"
              value={formatAmt(groupAmt.amount, dominantCurrency)}
              color="#a855f7"
              className="bg-white/5"
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {topCategory && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
              {CATEGORY_EMOJI[topCategory.name] ?? '📦'}
              <span>
                Top: <span className="font-semibold capitalize">{topCategory.name}</span>
              </span>
            </span>
          )}
          {paidMoreThanOwed && (
            <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-xs text-cyan-300">
              💸 biggest contributor
            </span>
          )}
          {biggestExpense && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
              🔥{' '}
              <span>
                Biggest: <span className="font-semibold">{biggestExpense.name}</span>
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      {catData.length > 1 && (
        <div className="mb-4 overflow-hidden rounded-3xl p-5" style={DARK_CARD_STYLE}>
          <p className="mb-1 text-xs font-medium tracking-widest text-white/50 uppercase">
            spending by category
          </p>
          <div className="flex gap-4">
            <div className="w-44 flex-shrink-0">
              <DonutChart data={catData} label={topCategory?.name} />
            </div>
            <div className="flex-1 py-2">
              <CategoryLegend items={catData} />
            </div>
          </div>
        </div>
      )}

      {/* Group breakdown */}
      {groupData.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-3xl p-5" style={DARK_CARD_STYLE}>
          <p className="mb-3 text-xs font-medium tracking-widest text-white/50 uppercase">
            spending by group
          </p>
          <div className="flex flex-col gap-3">
            {groupData.map((g) => (
              <GroupBar key={g.name} name={g.name} amount={g.amount} pct={g.pct} color={g.color} />
            ))}
          </div>
          {groupData[0] && (
            <p className="mt-3 text-xs text-white/40">
              🏆 Most active: <span className="font-medium text-white/70">{groupData[0].name}</span>
            </p>
          )}
        </div>
      )}

      {/* Biggest expense card */}
      {biggestExpense && (
        <div
          className="mb-4 flex items-center justify-between overflow-hidden rounded-3xl px-5 py-4"
          style={BIGGEST_CARD_STYLE}
        >
          <div>
            <p className="text-xs font-medium tracking-widest text-white/50 uppercase">
              biggest expense
            </p>
            <p className="mt-0.5 text-base font-bold text-white">{biggestExpense.name}</p>
          </div>
          <p className="text-xl font-black text-purple-400">
            {formatAmt(biggestExpense.amount, biggestExpense.currency)}
          </p>
        </div>
      )}
    </div>
  );
};
