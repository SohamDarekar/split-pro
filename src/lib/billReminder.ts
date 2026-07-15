import { BillReminderStatus } from '@prisma/client';

/**
 * Equal split, integer-division based: remainder pennies go to the lowest
 * userIds first. Simpler than the client's seeded-random remainder pick in
 * addStore.ts, but produces the same per-participant totals up to rounding.
 */
export const computeEqualSplitParticipants = (
  amount: bigint,
  payerId: number,
  memberIds: number[],
): { userId: number; amount: bigint }[] => {
  const sortedMemberIds = [...memberIds].sort((a, b) => a - b);
  const n = BigInt(sortedMemberIds.length);
  const base = amount / n;
  const remainder = Number(amount % n);

  const shares = new Map<number, bigint>();
  sortedMemberIds.forEach((userId, index) => {
    shares.set(userId, base + (index < remainder ? 1n : 0n));
  });

  return sortedMemberIds.map((userId) => ({
    userId,
    amount: userId === payerId ? amount - shares.get(userId)! : -shares.get(userId)!,
  }));
};

/**
 * Recurring and non-recurring reminders both hold at PAST_DUE once overdue with
 * no amount entered — recurring reminders only move to NEEDS_NEXT_DATE when the
 * creator resolves the cycle (amount entered -> expense created) or explicitly
 * skips it. See skipBillReminderCycle / submitBillReminderAmount.
 */
export const computeReminderStatus = (
  dueDate: Date,
  currentStatus: BillReminderStatus,
  now: Date = new Date(),
): BillReminderStatus => {
  if (currentStatus === BillReminderStatus.COMPLETED) {
    return currentStatus;
  }
  if (now < dueDate) {
    return BillReminderStatus.UPCOMING;
  }
  return BillReminderStatus.PAST_DUE;
};

/** Whole-day count from now to dueDate, 0 = due today. Negative once past due. */
export const daysUntil = (dueDate: Date, now: Date): number => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay.getTime() - today.getTime()) / msPerDay);
};

// Bill reminder notification copy. Exact strings per spec — never reword or auto-generate alternates.
export const CREATOR_PROMPT_COPY: Record<number, (title: string, group: string) => string> = {
  3: (title, group) =>
    `${title} is due in 3 days. Add the amount so it can be split with ${group}.`,
  2: (title, group) => `${title} is due in 2 days — add the amount to split it with ${group}.`,
  1: (title, group) =>
    `${title} is due tomorrow. Add the amount now so ${group} can settle up in time.`,
};

export const MEMBER_NOTICE_COPY: Record<number, (title: string, group: string) => string> = {
  10: (title, group) => `Heads up — ${title} is due in 10 days for ${group}.`,
  7: (title, group) => `${title} is due in a week for ${group}.`,
  5: (title, group) => `${title} is due in 5 days for ${group}.`,
  3: (title, group) => `${title} is due in 3 days for ${group}.`,
  2: (title, group) => `${title} is due in 2 days for ${group}.`,
  1: (title, group) => `${title} is due tomorrow for ${group}.`,
};

export const PERSONAL_DUE_TODAY_COPY = (title: string): string =>
  `Reminder: ${title} is due today.`;

// Overdue nudges: creator-only, fires while status is PAST_DUE, stops after day 14.
// Distinct tone from the pre-due prompts above — "this is overdue" vs "coming up soon".
export const CREATOR_OVERDUE_COPY: Record<number, (title: string, group: string) => string> = {
  3: (title, group) => `${title} is 3 days overdue. Add the amount so ${group} can settle up.`,
  7: (title, group) => `${title} is a week overdue. ${group} is waiting on the amount.`,
  14: (title, group) =>
    `${title} is 2 weeks overdue. Add the amount or skip this cycle for ${group}.`,
};

export const CREATOR_THRESHOLDS = [3, 2, 1];
export const MEMBER_THRESHOLDS = [10, 7, 5, 3, 2, 1];
export const CREATOR_OVERDUE_THRESHOLDS = [3, 7, 14];

// Distinct dedupe-key ranges so pre-due, member, and overdue notifications never
// Collide in BillReminderNotification's [billReminderId, userId, dayOffset] PK.
export const creatorOverdueDayOffset = (daysOverdue: number): number => 200 + daysOverdue;
export const memberNoticeDayOffset = (daysLeft: number): number => 100 + daysLeft;
