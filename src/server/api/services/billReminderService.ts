import { BillReminderStatus, SplitType } from '@prisma/client';
import { db } from '~/server/db';
import { createExpense } from './splitService';
import { computeEqualSplitParticipants, computeReminderStatus } from '~/lib/billReminder';

export { computeEqualSplitParticipants, computeReminderStatus };

export async function createBillReminder(input: {
  title: string;
  dueDate: Date;
  isRecurring: boolean;
  groupId: number | null;
  memberIds: number[];
  createdBy: number;
}) {
  const { title, dueDate, isRecurring, groupId, memberIds, createdBy } = input;

  if (groupId !== null) {
    const membership = await db.groupUser.findUnique({
      where: { groupId_userId: { groupId, userId: createdBy } },
    });
    if (!membership) {
      throw new Error('Not a member of this group');
    }

    const validMembers = await db.groupUser.findMany({
      where: { groupId, userId: { in: memberIds } },
      select: { userId: true },
    });
    if (validMembers.length !== memberIds.length) {
      throw new Error('One or more selected members are not in this group');
    }
  }

  return db.billReminder.create({
    data: {
      title,
      dueDate,
      isRecurring,
      groupId,
      createdBy,
      status: computeReminderStatus(dueDate, BillReminderStatus.UPCOMING),
      members: groupId === null ? undefined : { create: memberIds.map((userId) => ({ userId })) },
    },
    include: { members: true, group: true },
  });
}

export async function updateBillReminderMembers(
  billReminderId: number,
  requestorId: number,
  memberIds: number[],
) {
  const reminder = await db.billReminder.findUnique({ where: { id: billReminderId } });
  if (!reminder) {
    throw new Error('Reminder not found');
  }
  if (reminder.createdBy !== requestorId) {
    throw new Error('Only the creator can edit this reminder');
  }
  if (reminder.groupId === null) {
    throw new Error('Personal reminders have no member selection');
  }

  const validMembers = await db.groupUser.findMany({
    where: { groupId: reminder.groupId, userId: { in: memberIds } },
    select: { userId: true },
  });
  if (validMembers.length !== memberIds.length) {
    throw new Error('One or more selected members are not in this group');
  }

  await db.$transaction([
    db.billReminderMember.deleteMany({ where: { billReminderId } }),
    db.billReminderMember.createMany({
      data: memberIds.map((userId) => ({ billReminderId, userId })),
    }),
  ]);

  return db.billReminder.findUnique({
    where: { id: billReminderId },
    include: { members: true },
  });
}

export async function setNextDueDate(billReminderId: number, requestorId: number, dueDate: Date) {
  const reminder = await db.billReminder.findUnique({ where: { id: billReminderId } });
  if (!reminder) {
    throw new Error('Reminder not found');
  }
  if (reminder.createdBy !== requestorId) {
    throw new Error('Only the creator can update this reminder');
  }
  if (!reminder.isRecurring) {
    throw new Error('Only recurring reminders support setting a next due date');
  }

  return db.$transaction(async (tx) => {
    await tx.billReminderNotification.deleteMany({ where: { billReminderId } });
    return tx.billReminder.update({
      where: { id: billReminderId },
      data: {
        dueDate,
        expenseId: null,
        status: computeReminderStatus(dueDate, BillReminderStatus.UPCOMING),
      },
    });
  });
}

export async function skipBillReminderCycle(billReminderId: number, requestorId: number) {
  const reminder = await db.billReminder.findUnique({ where: { id: billReminderId } });
  if (!reminder) {
    throw new Error('Reminder not found');
  }
  if (reminder.createdBy !== requestorId) {
    throw new Error('Only the creator can skip this cycle');
  }
  if (!reminder.isRecurring) {
    throw new Error('Only recurring reminders support skipping a cycle');
  }
  if (reminder.status !== BillReminderStatus.PAST_DUE) {
    throw new Error('Only an overdue, unresolved cycle can be skipped');
  }

  return db.$transaction(async (tx) => {
    await tx.billReminderNotification.deleteMany({ where: { billReminderId } });
    return tx.billReminder.update({
      where: { id: billReminderId },
      data: {
        expenseId: null,
        status: BillReminderStatus.NEEDS_NEXT_DATE,
      },
    });
  });
}

export async function deleteBillReminder(billReminderId: number, requestorId: number) {
  const reminder = await db.billReminder.findUnique({ where: { id: billReminderId } });
  if (!reminder) {
    throw new Error('Reminder not found');
  }
  if (reminder.createdBy !== requestorId) {
    throw new Error('Only the creator can delete this reminder');
  }
  await db.billReminder.delete({ where: { id: billReminderId } });
}

export async function submitBillReminderAmount(
  billReminderId: number,
  requestorId: number,
  amount: bigint,
  currency: string,
  category: string,
) {
  const reminder = await db.billReminder.findUnique({
    where: { id: billReminderId },
    include: { members: true },
  });
  if (!reminder) {
    throw new Error('Reminder not found');
  }
  if (reminder.createdBy !== requestorId) {
    throw new Error('Only the creator can enter the amount');
  }
  if (reminder.groupId === null) {
    throw new Error('Personal reminders do not create expenses');
  }
  if (reminder.expenseId !== null) {
    throw new Error('Amount already entered for this cycle');
  }

  const memberIds = reminder.members.map((m) => m.userId);
  const participants = computeEqualSplitParticipants(amount, requestorId, memberIds);

  const expense = await createExpense(
    {
      groupId: reminder.groupId,
      paidBy: requestorId,
      name: reminder.title,
      category,
      amount,
      splitType: SplitType.EQUAL,
      currency,
      participants,
      expenseDate: new Date(),
    },
    requestorId,
  );

  await db.billReminder.update({
    where: { id: billReminderId },
    data: {
      expenseId: expense.id,
      status: reminder.isRecurring
        ? BillReminderStatus.NEEDS_NEXT_DATE
        : BillReminderStatus.COMPLETED,
    },
  });

  return expense;
}

/**
 * Recomputes UPCOMING -> PAST_DUE for reminders that just crossed their due date.
 * Recurring reminders hold at PAST_DUE too — they only leave that state via
 * submitBillReminderAmount (resolved) or skipBillReminderCycle (explicitly skipped),
 * never automatically. See computeReminderStatus for the rationale.
 */
export async function refreshOverdueStatuses(now: Date = new Date()) {
  await db.billReminder.updateMany({
    where: { status: BillReminderStatus.UPCOMING, dueDate: { lte: now } },
    data: { status: BillReminderStatus.PAST_DUE },
  });
}
