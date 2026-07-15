import { BillReminderStatus } from '@prisma/client';

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

mockDb.$transaction.mockImplementation(async (arg: unknown) =>
  typeof arg === 'function'
    ? (arg as (tx: MockDb) => unknown)(mockDb)
    : Promise.all(arg as unknown[]),
);

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: MockDb) => unknown)(mockDb)
      : Promise.all(arg as unknown[]),
  );
});

describe('refreshOverdueStatuses', () => {
  it('moves overdue reminders to PAST_DUE regardless of isRecurring (no auto NEEDS_NEXT_DATE)', async () => {
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
    isRecurring: true,
    status: BillReminderStatus.PAST_DUE,
    groupId: 7,
    expenseId: null,
  };

  it('moves a PAST_DUE recurring reminder to NEEDS_NEXT_DATE without creating an expense', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce(baseReminder);
    mockDb.billReminder.update.mockResolvedValueOnce({
      ...baseReminder,
      status: BillReminderStatus.NEEDS_NEXT_DATE,
    });

    await skipBillReminderCycle(1, 42);

    expect(createExpense).not.toHaveBeenCalled();
    expect(mockDb.billReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { expenseId: null, status: BillReminderStatus.NEEDS_NEXT_DATE },
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

  it('rejects when the requestor is not the creator', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce(baseReminder);
    await expect(skipBillReminderCycle(1, 999)).rejects.toThrow('Only the creator');
  });

  it('rejects for non-recurring reminders', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({ ...baseReminder, isRecurring: false });
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
  it('resolves a recurring reminder into NEEDS_NEXT_DATE after creating the expense', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      id: 1,
      createdBy: 42,
      groupId: 7,
      isRecurring: true,
      expenseId: null,
      members: [{ userId: 42 }, { userId: 43 }],
    });
    (createExpense as jest.Mock).mockResolvedValueOnce({ id: 'expense-uuid' });

    await submitBillReminderAmount(1, 42, 100n, 'AUD', 'general');

    expect(createExpense).toHaveBeenCalled();
    expect(mockDb.billReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { expenseId: 'expense-uuid', status: BillReminderStatus.NEEDS_NEXT_DATE },
    });
  });
});
