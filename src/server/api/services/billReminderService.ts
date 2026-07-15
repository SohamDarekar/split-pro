import { BillReminderStatus, RecurrenceInterval, SplitType } from '@prisma/client';
import { db } from '~/server/db';
import { createExpense } from './splitService';
import {
  computeEqualSplitParticipants,
  computeNextDueDate,
  computeReminderStatus,
} from '~/lib/billReminder';

export { computeEqualSplitParticipants, computeNextDueDate, computeReminderStatus };

export async function createBillReminder(input: {
  title: string;
  dueDate: Date;
  recurrenceInterval: RecurrenceInterval | null;
  customIntervalDays: number | null;
  groupId: number | null;
  memberIds: number[];
  createdBy: number;
}) {
  const { title, dueDate, recurrenceInterval, customIntervalDays, groupId, memberIds, createdBy } =
    input;

  if (recurrenceInterval === RecurrenceInterval.CUSTOM && !customIntervalDays) {
    throw new Error('customIntervalDays is required when recurrence is Custom');
  }
  if (recurrenceInterval !== RecurrenceInterval.CUSTOM && customIntervalDays) {
    throw new Error('customIntervalDays only applies to Custom recurrence');
  }

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
      recurrenceInterval,
      customIntervalDays:
        recurrenceInterval === RecurrenceInterval.CUSTOM ? customIntervalDays : null,
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

/**
 * Manual override, kept as a fallback escape hatch (the automatic cycle-resolution
 * paths below no longer need it since MONTHLY/QUARTERLY/HALF_YEARLY/YEARLY overflow
 * is resolved by clamping — see computeNextDueDate). Still useful if a creator wants
 * to override the computed date by hand.
 */
export async function setNextDueDate(billReminderId: number, requestorId: number, dueDate: Date) {
  const reminder = await db.billReminder.findUnique({ where: { id: billReminderId } });
  if (!reminder) {
    throw new Error('Reminder not found');
  }
  if (reminder.createdBy !== requestorId) {
    throw new Error('Only the creator can update this reminder');
  }
  if (reminder.recurrenceInterval === null) {
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

/**
 * Skips an overdue, unresolved cycle without creating an expense. Auto-advances
 * straight to the next computed due date and back to UPCOMING (mirrors
 * submitBillReminderAmount's resolution) rather than parking at NEEDS_NEXT_DATE —
 * per product decision, the manual date field is now only a fallback, not the
 * normal path. Group/member config is untouched.
 */
export async function skipBillReminderCycle(billReminderId: number, requestorId: number) {
  const reminder = await db.billReminder.findUnique({ where: { id: billReminderId } });
  if (!reminder) {
    throw new Error('Reminder not found');
  }
  if (reminder.createdBy !== requestorId) {
    throw new Error('Only the creator can skip this cycle');
  }
  if (reminder.recurrenceInterval === null) {
    throw new Error('Only recurring reminders support skipping a cycle');
  }
  if (reminder.status !== BillReminderStatus.PAST_DUE) {
    throw new Error('Only an overdue, unresolved cycle can be skipped');
  }

  const nextDueDate = computeNextDueDate(
    reminder.dueDate,
    reminder.recurrenceInterval,
    reminder.customIntervalDays,
  );

  return db.$transaction(async (tx) => {
    await tx.billReminderNotification.deleteMany({ where: { billReminderId } });
    return tx.billReminder.update({
      where: { id: billReminderId },
      data: {
        expenseId: null,
        dueDate: nextDueDate,
        status: computeReminderStatus(nextDueDate, BillReminderStatus.UPCOMING),
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

  // Resolving the cycle: recurring reminders auto-advance straight to their next
  // Computed due date and UPCOMING; non-recurring reminders are simply COMPLETED.
  if (reminder.recurrenceInterval !== null) {
    const nextDueDate = computeNextDueDate(
      reminder.dueDate,
      reminder.recurrenceInterval,
      reminder.customIntervalDays,
    );
    // ExpenseId reflects the *current* cycle's resolved expense only. We advance
    // Straight into the next cycle here, so it's cleared back to null immediately
    // (the just-resolved expense.id is still returned to the caller below).
    await db.$transaction(async (tx) => {
      await tx.billReminderNotification.deleteMany({ where: { billReminderId } });
      await tx.billReminder.update({
        where: { id: billReminderId },
        data: {
          expenseId: null,
          dueDate: nextDueDate,
          status: computeReminderStatus(nextDueDate, BillReminderStatus.UPCOMING),
        },
      });
    });
  } else {
    await db.billReminder.update({
      where: { id: billReminderId },
      data: { expenseId: expense.id, status: BillReminderStatus.COMPLETED },
    });
  }

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
