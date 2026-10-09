import { BillReminderStatus, RecurrenceInterval } from '@prisma/client';

interface MockDb {
  billReminder: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };
  billReminderNotification: {
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

jest.mock('~/server/db', () => ({
  db: {
    billReminder: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    billReminderNotification: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock('~/server/api/services/splitService', () => ({ createExpense: jest.fn() }));

import {
  deleteBillReminder,
  refreshOverdueStatuses,
  skipBillReminderCycle,
  submitBillReminderAmount,
} from '~/server/api/services/billReminderService';
import { createExpense } from '~/server/api/services/splitService';
import { db } from '~/server/db';

const mockDb = db as unknown as MockDb;

const setupTransaction = () => {
  mockDb.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: MockDb) => unknown)(mockDb)
      : Promise.all(arg as unknown[]),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  setupTransaction();
  // Fixtures use fixed 2026-07/08 due dates; pin "now" so status expectations don't age out
  jest.useFakeTimers({ now: new Date('2026-07-15T00:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('refreshOverdueStatuses', () => {
  it('moves overdue reminders to PAST_DUE regardless of recurrence (no auto NEEDS_NEXT_DATE)', async () => {
    await refreshOverdueStatuses(new Date('2026-07-15T00:00:00Z'));

    expect(mockDb.billReminder.updateMany).toHaveBeenCalledWith({
      where: {
        status: BillReminderStatus.UPCOMING,
        dueDate: { lte: new Date('2026-07-15T00:00:00Z') },
      },
      data: { status: BillReminderStatus.PAST_DUE },
    });
  });
});

describe('skipBillReminderCycle', () => {
  const baseReminder = {
    id: 1,
    createdBy: 42,
    recurrenceInterval: RecurrenceInterval.MONTHLY,
    customIntervalDays: null,
    status: BillReminderStatus.PAST_DUE,
    groupId: 7,
    dueDate: new Date('2026-07-01T00:00:00Z'),
    expenseId: null,
  };

  it('auto-advances a PAST_DUE recurring reminder to the next computed due date and UPCOMING, without creating an expense', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce(baseReminder);
    mockDb.billReminder.update.mockResolvedValueOnce({ ...baseReminder });

    await skipBillReminderCycle(1, 42);

    expect(createExpense).not.toHaveBeenCalled();
    expect(mockDb.billReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        expenseId: null,
        dueDate: new Date('2026-08-01T00:00:00Z'),
        status: BillReminderStatus.UPCOMING,
      },
    });
    // Member/group config untouched: skip never touches billReminderMember or group fields.
    expect(mockDb.billReminder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ groupId: expect.anything() }) }),
    );
  });

  it('clears prior notification dedupe log so the new cycle starts fresh', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce(baseReminder);
    mockDb.billReminder.update.mockResolvedValueOnce(baseReminder);

    await skipBillReminderCycle(1, 42);

    expect(mockDb.billReminderNotification.deleteMany).toHaveBeenCalledWith({
      where: { billReminderId: 1 },
    });
  });

  it('uses the CUSTOM interval day-offset when advancing', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      ...baseReminder,
      recurrenceInterval: RecurrenceInterval.CUSTOM,
      customIntervalDays: 45,
      dueDate: new Date('2026-07-01T00:00:00Z'),
    });
    mockDb.billReminder.update.mockResolvedValueOnce(baseReminder);

    await skipBillReminderCycle(1, 42);

    expect(mockDb.billReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        expenseId: null,
        dueDate: new Date('2026-08-15T00:00:00Z'),
        status: BillReminderStatus.UPCOMING,
      },
    });
  });

  it('rejects when the requestor is not the creator', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce(baseReminder);
    await expect(skipBillReminderCycle(1, 999)).rejects.toThrow('Only the creator');
  });

  it('rejects for non-recurring reminders', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      ...baseReminder,
      recurrenceInterval: null,
    });
    await expect(skipBillReminderCycle(1, 42)).rejects.toThrow('Only recurring reminders');
  });

  it('rejects when the cycle is not overdue/unresolved', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      ...baseReminder,
      status: BillReminderStatus.UPCOMING,
    });
    await expect(skipBillReminderCycle(1, 42)).rejects.toThrow('overdue');
  });
});

describe('deleteBillReminder (destructive Dismiss)', () => {
  it('fully deletes the reminder row', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({ id: 1, createdBy: 42 });

    await deleteBillReminder(1, 42);

    expect(mockDb.billReminder.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('rejects when the requestor is not the creator', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({ id: 1, createdBy: 999 });
    await expect(deleteBillReminder(1, 42)).rejects.toThrow('Only the creator');
    expect(mockDb.billReminder.delete).not.toHaveBeenCalled();
  });
});

describe('submitBillReminderAmount', () => {
  it('auto-advances a recurring reminder to its next computed due date and UPCOMING after creating the expense, clearing expenseId for the new cycle', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      id: 1,
      createdBy: 42,
      groupId: 7,
      recurrenceInterval: RecurrenceInterval.MONTHLY,
      customIntervalDays: null,
      dueDate: new Date('2026-07-15T00:00:00Z'),
      expenseId: null,
      members: [{ userId: 42 }, { userId: 43 }],
    });
    (createExpense as jest.Mock).mockResolvedValueOnce({ id: 'expense-uuid' });

    const expense = await submitBillReminderAmount(1, 42, 100n, 'AUD', 'general');

    expect(createExpense).toHaveBeenCalled();
    expect(expense).toEqual({ id: 'expense-uuid' });
    expect(mockDb.billReminderNotification.deleteMany).toHaveBeenCalledWith({
      where: { billReminderId: 1 },
    });
    expect(mockDb.billReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        expenseId: null,
        dueDate: new Date('2026-08-15T00:00:00Z'),
        status: BillReminderStatus.UPCOMING,
      },
    });
  });

  it('marks a non-recurring reminder COMPLETED and keeps the expense link', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      id: 1,
      createdBy: 42,
      groupId: 7,
      recurrenceInterval: null,
      customIntervalDays: null,
      dueDate: new Date('2026-07-15T00:00:00Z'),
      expenseId: null,
      members: [{ userId: 42 }, { userId: 43 }],
    });
    (createExpense as jest.Mock).mockResolvedValueOnce({ id: 'expense-uuid' });

    await submitBillReminderAmount(1, 42, 100n, 'AUD', 'general');

    expect(mockDb.billReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { expenseId: 'expense-uuid', status: BillReminderStatus.COMPLETED },
    });
  });
});
