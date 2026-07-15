import { BillReminderStatus } from '@prisma/client';
import {
  CREATOR_OVERDUE_COPY,
  CREATOR_OVERDUE_THRESHOLDS,
  CREATOR_PROMPT_COPY,
  CREATOR_THRESHOLDS,
  MEMBER_NOTICE_COPY,
  MEMBER_THRESHOLDS,
  PERSONAL_DUE_TODAY_COPY,
  computeEqualSplitParticipants,
  computeReminderStatus,
  daysUntil,
} from '~/lib/billReminder';

describe('computeEqualSplitParticipants', () => {
  it('splits evenly with no remainder', () => {
    const result = computeEqualSplitParticipants(300n, 1, [1, 2, 3]);
    const byUser = Object.fromEntries(result.map((p) => [p.userId, p.amount]));
    expect(byUser[1]).toBe(200n); // Payer: 300 total - 100 own share
    expect(byUser[2]).toBe(-100n);
    expect(byUser[3]).toBe(-100n);
    expect(result.reduce((acc, p) => acc + p.amount, 0n)).toBe(0n);
  });

  it('distributes remainder pennies to lowest userIds first', () => {
    const result = computeEqualSplitParticipants(100n, 5, [5, 6, 7]);
    // Base = 33, remainder = 1 -> lowest userId (5) gets the extra penny
    const byUser = Object.fromEntries(result.map((p) => [p.userId, p.amount]));
    expect(byUser[5]).toBe(66n); // Payer=5, share=34 -> 100-34
    expect(byUser[6]).toBe(-33n);
    expect(byUser[7]).toBe(-33n);
    expect(result.reduce((acc, p) => acc + p.amount, 0n)).toBe(0n);
  });

  it('sums to zero regardless of payer position', () => {
    const result = computeEqualSplitParticipants(101n, 2, [1, 2, 3, 4]);
    expect(result.reduce((acc, p) => acc + p.amount, 0n)).toBe(0n);
  });
});

describe('computeReminderStatus', () => {
  const now = new Date('2026-07-15T00:00:00Z');

  it('stays UPCOMING before due date', () => {
    const dueDate = new Date('2026-07-20T00:00:00Z');
    expect(computeReminderStatus(dueDate, BillReminderStatus.UPCOMING, now)).toBe(
      BillReminderStatus.UPCOMING,
    );
  });

  it('flips non-recurring to PAST_DUE once overdue', () => {
    const dueDate = new Date('2026-07-10T00:00:00Z');
    expect(computeReminderStatus(dueDate, BillReminderStatus.UPCOMING, now)).toBe(
      BillReminderStatus.PAST_DUE,
    );
  });

  it('holds recurring at PAST_DUE once overdue too — no auto NEEDS_NEXT_DATE', () => {
    // Recurring reminders only leave PAST_DUE via an explicit resolution:
    // SubmitBillReminderAmount (expense created) or skipBillReminderCycle (skipped).
    const dueDate = new Date('2026-07-10T00:00:00Z');
    expect(computeReminderStatus(dueDate, BillReminderStatus.UPCOMING, now)).toBe(
      BillReminderStatus.PAST_DUE,
    );
  });

  it('never reverts COMPLETED', () => {
    const dueDate = new Date('2026-07-01T00:00:00Z');
    expect(computeReminderStatus(dueDate, BillReminderStatus.COMPLETED, now)).toBe(
      BillReminderStatus.COMPLETED,
    );
  });
});

describe('daysUntil', () => {
  it('is 0 on the due date itself', () => {
    const now = new Date('2026-07-15T18:00:00');
    const dueDate = new Date('2026-07-15T00:00:00');
    expect(daysUntil(dueDate, now)).toBe(0);
  });

  it('counts whole days regardless of time-of-day', () => {
    const now = new Date('2026-07-12T23:59:00');
    const dueDate = new Date('2026-07-15T00:01:00');
    expect(daysUntil(dueDate, now)).toBe(3);
  });

  it('goes negative once overdue', () => {
    const now = new Date('2026-07-16T00:00:00');
    const dueDate = new Date('2026-07-15T00:00:00');
    expect(daysUntil(dueDate, now)).toBe(-1);
  });
});

describe('notification copy — exact strings, never reworded', () => {
  it('creator prompts match spec verbatim', () => {
    expect(CREATOR_PROMPT_COPY[3]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due in 3 days. Add the amount so it can be split with Flatmates.',
    );
    expect(CREATOR_PROMPT_COPY[2]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due in 2 days — add the amount to split it with Flatmates.',
    );
    expect(CREATOR_PROMPT_COPY[1]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due tomorrow. Add the amount now so Flatmates can settle up in time.',
    );
  });

  it('member notices match spec verbatim, including "a week" and "tomorrow" special cases', () => {
    expect(MEMBER_NOTICE_COPY[10]!('Electricity', 'Flatmates')).toBe(
      'Heads up — Electricity is due in 10 days for Flatmates.',
    );
    expect(MEMBER_NOTICE_COPY[7]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due in a week for Flatmates.',
    );
    expect(MEMBER_NOTICE_COPY[5]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due in 5 days for Flatmates.',
    );
    expect(MEMBER_NOTICE_COPY[3]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due in 3 days for Flatmates.',
    );
    expect(MEMBER_NOTICE_COPY[2]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due in 2 days for Flatmates.',
    );
    expect(MEMBER_NOTICE_COPY[1]!('Electricity', 'Flatmates')).toBe(
      'Electricity is due tomorrow for Flatmates.',
    );
  });

  it('personal due-today copy matches spec verbatim', () => {
    expect(PERSONAL_DUE_TODAY_COPY('Rent')).toBe('Reminder: Rent is due today.');
  });

  it('thresholds are exactly the spec-defined day counts', () => {
    expect(CREATOR_THRESHOLDS).toEqual([3, 2, 1]);
    expect(MEMBER_THRESHOLDS).toEqual([10, 7, 5, 3, 2, 1]);
  });

  it('overdue nudge copy matches spec verbatim and is distinct from the pre-due prompts', () => {
    expect(CREATOR_OVERDUE_COPY[3]!('Electricity', 'Flatmates')).toBe(
      'Electricity is 3 days overdue. Add the amount so Flatmates can settle up.',
    );
    expect(CREATOR_OVERDUE_COPY[7]!('Electricity', 'Flatmates')).toBe(
      'Electricity is a week overdue. Flatmates is waiting on the amount.',
    );
    expect(CREATOR_OVERDUE_COPY[14]!('Electricity', 'Flatmates')).toBe(
      'Electricity is 2 weeks overdue. Add the amount or skip this cycle for Flatmates.',
    );
  });

  it('overdue nudges fire only at 3, 7, and 14 days overdue — not before or after', () => {
    expect(CREATOR_OVERDUE_THRESHOLDS).toEqual([3, 7, 14]);
    [1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 20, 30].forEach((daysOverdue) => {
      expect(CREATOR_OVERDUE_THRESHOLDS.includes(daysOverdue)).toBe(false);
    });
  });
});
