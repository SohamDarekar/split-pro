import { BillReminderStatus, SplitType } from '@prisma/client';
import { isCurrencyCode } from '~/lib/currency';
import { type PushMessage } from '~/types';

import { db } from '~/server/db';
import { sendPaymentReminderEmail } from '~/server/mailer';
import { pushNotification } from '~/server/notification';
import { getCurrencyHelpers } from '~/utils/numbers';
import { refreshOverdueStatuses } from './billReminderService';
import {
  CREATOR_OVERDUE_COPY,
  CREATOR_OVERDUE_THRESHOLDS,
  CREATOR_PROMPT_COPY,
  CREATOR_THRESHOLDS,
  MEMBER_NOTICE_COPY,
  MEMBER_THRESHOLDS,
  PERSONAL_DUE_TODAY_COPY,
  creatorOverdueDayOffset,
  daysUntil,
  memberNoticeDayOffset,
} from '~/lib/billReminder';

export const getSubscriptionEndpoint = (subscription: string) => {
  try {
    const parsed = JSON.parse(subscription) as { endpoint?: string };
    if ('string' === typeof parsed.endpoint && '' !== parsed.endpoint) {
      return parsed.endpoint;
    }
  } catch {
    return null;
  }

  return null;
};

const removeStalePushSubscriptions = async (
  subscriptions: { userId: number; endpoint: string }[],
) => {
  if (0 === subscriptions.length) {
    return;
  }

  await db.pushNotification.deleteMany({
    where: {
      OR: subscriptions.map((subscription) => ({
        userId: subscription.userId,
        endpoint: subscription.endpoint,
      })),
    },
  });
};

const isPermanentPushFailure = (statusCode: number | undefined) =>
  404 === statusCode || 410 === statusCode;

export const sendPushNotificationToUsers = async (userIds: number[], pushData: PushMessage) => {
  if (0 === userIds.length) {
    return { sentCount: 0, error: undefined };
  }

  const subscriptions = await db.pushNotification.findMany({
    where: {
      userId: {
        in: userIds,
      },
    },
  });

  if (0 === subscriptions.length) {
    return { sentCount: 0, error: 'No push subscription found for this device/account' };
  }

  const pushResults = await Promise.all(
    subscriptions.map(async (s) => {
      const result = await pushNotification(s.subscription, pushData);
      return { ...result, userId: s.userId, endpoint: s.endpoint };
    }),
  );

  await removeStalePushSubscriptions(
    pushResults
      .filter((result) => !result.ok && isPermanentPushFailure(result.statusCode))
      .map((result) => ({ userId: result.userId, endpoint: result.endpoint })),
  );

  const firstFailure = pushResults.find((result) => !result.ok);

  return {
    sentCount: pushResults.filter((result) => result.ok).length,
    error: firstFailure && !firstFailure.ok ? firstFailure.error : undefined,
  };
};

export async function sendExpensePushNotification(expenseId: string) {
  const expense = await db.expense.findUnique({
    where: {
      id: expenseId,
    },
    select: {
      paidBy: true,
      amount: true,
      currency: true,
      addedBy: true,
      name: true,
      deletedBy: true,
      splitType: true,
      deletedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
      expenseParticipants: {
        select: {
          userId: true,
          amount: true,
        },
      },
      paidByUser: {
        select: {
          name: true,
          email: true,
        },
      },
      addedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
      updatedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
      conversionTo: {
        select: {
          currency: true,
          amount: true,
        },
      },
    },
  });

  if (!expense) {
    return;
  }

  const participants = expense.deletedBy
    ? expense.expenseParticipants.filter(
        ({ userId, amount }) => userId !== expense.deletedBy && 0n !== amount,
      )
    : expense.expenseParticipants.filter(
        ({ userId, amount }) => userId !== expense.addedBy && 0n !== amount,
      );

  // A way to localize it and reuse our utils would be ideal
  const getUserDisplayName = (user: { name: string | null; email: string | null } | null) =>
    user?.name ?? user?.email ?? '';

  const formatAmount = (currency: string, amount: bigint) => {
    const { toUIString } = getCurrencyHelpers({
      currency: isCurrencyCode(currency) ? currency : 'AUD',
    });
    return toUIString(amount);
  };

  const getNotificationContent = (): { title: string; message: string } => {
    const payer = getUserDisplayName(expense.paidByUser);
    const adder = getUserDisplayName(expense.addedByUser);
    const amount = formatAmount(expense.currency, expense.amount);

    // Deleted expense
    if (expense.deletedBy) {
      return {
        title: getUserDisplayName(expense.deletedByUser),
        message: `Deleted ${expense.name}`,
      };
    }

    // Updated expense
    if (expense.updatedByUser) {
      return {
        title: getUserDisplayName(expense.updatedByUser),
        message: `Updated ${expense.name} ${amount}`,
      };
    }

    // Currency conversion
    if (expense.splitType === SplitType.CURRENCY_CONVERSION && expense.conversionTo) {
      const toAmount = formatAmount(expense.conversionTo.currency, expense.conversionTo.amount);
      return {
        title: adder,
        message: `${payer} converted ${amount} → ${toAmount}`,
      };
    }

    // Settlement
    if (expense.splitType === SplitType.SETTLEMENT) {
      return {
        title: adder,
        message: `${payer} settled up ${amount}`,
      };
    }

    // Regular expense
    return {
      title: adder,
      message: `${payer} paid ${amount} for ${expense.name}`,
    };
  };

  const pushData = {
    ...getNotificationContent(),
    data: {
      url: `/expenses/${expenseId}`,
    },
  };

  await sendPushNotificationToUsers(
    participants.map((p) => p.userId),
    pushData,
  );
}

export async function sendGroupSimplifyDebtsToggleNotification(
  groupId: number,
  togglerUserId: number,
  newState: boolean,
) {
  try {
    const group = await db.group.findUnique({
      where: {
        id: groupId,
      },
      select: {
        name: true,
        groupUsers: {
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return;
    }

    const togglerUser = await db.user.findUnique({
      where: {
        id: togglerUserId,
      },
      select: {
        name: true,
        email: true,
      },
    });

    if (!togglerUser) {
      return;
    }

    // Filter out the toggler from recipients
    const recipients = group.groupUsers.filter((gu) => gu.userId !== togglerUserId);

    if (recipients.length === 0) {
      return;
    }

    const getUserDisplayName = (user: { name: string | null; email: string | null } | null) =>
      user?.name ?? user?.email ?? '';

    const togglerName = getUserDisplayName(togglerUser);
    const stateText = newState ? 'on' : 'off';

    const pushData = {
      title: togglerName,
      message: `turned ${stateText} debt simplification for ${group.name}`,
      data: {
        url: `/groups/${groupId}`,
      },
    };

    await sendPushNotificationToUsers(
      recipients.map((r) => r.userId),
      pushData,
    );
  } catch (error) {
    console.error('Error sending group simplify debts toggle notifications', error);
  }
}

export async function checkRecurrenceNotifications() {
  try {
    const recurrences = await db.expenseRecurrence.findMany({
      where: {
        NOT: {
          notified: true,
        },
      },
      include: {
        expense: {
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    await Promise.all(
      recurrences
        .filter((r) => r.expense[0])
        .map(async (r) => {
          await sendExpensePushNotification(r.expense[0]!.id);
          await db.expenseRecurrence.update({
            where: {
              id: r.id,
            },
            data: {
              notified: true,
            },
          });
        }),
    );
  } catch (e) {
    console.error('Error sending recurrence notifications', e);
  } finally {
    setTimeout(checkRecurrenceNotifications, 1000 * 60); // Check every minute
  }
}

const REMINDER_DAYS = [1, 3, 5, 7, 10, 15, 20, 25, 30];

const getReminderDayOffset = (daysElapsed: number): number | null => {
  if (daysElapsed <= 0) {
    return null;
  }
  // Exact match for scheduled days up to 30
  if (REMINDER_DAYS.includes(daysElapsed)) {
    return daysElapsed;
  }
  // Daily after day 30
  if (daysElapsed > 30) {
    return daysElapsed;
  }
  return null;
};

const getReminderContent = (
  payerName: string,
  expenseName: string,
  amount: string,
  daysOutstanding: number,
): { title: string; message: string } => {
  if (daysOutstanding <= 1) {
    return {
      title: `Reminder from ${payerName}`,
      message: `${payerName} paid ${amount} for "${expenseName}". Settle up when you get a chance!`,
    };
  }
  if (daysOutstanding <= 3) {
    return {
      title: `Just a heads-up from ${payerName}`,
      message: `${payerName} is still waiting on ${amount} for "${expenseName}". No rush, but please settle soon.`,
    };
  }
  if (daysOutstanding <= 5) {
    return {
      title: `${payerName} is waiting`,
      message: `It's been ${daysOutstanding} days — ${payerName} paid ${amount} for "${expenseName}". Please settle up.`,
    };
  }
  if (daysOutstanding <= 7) {
    return {
      title: `Please settle up with ${payerName}`,
      message: `A week has passed since ${payerName} paid ${amount} for "${expenseName}". Kindly reimburse them soon.`,
    };
  }
  if (daysOutstanding <= 10) {
    return {
      title: `Action needed: ${amount} owed to ${payerName}`,
      message: `${daysOutstanding} days overdue — ${payerName} paid ${amount} for "${expenseName}". Please settle this now.`,
    };
  }
  if (daysOutstanding <= 15) {
    return {
      title: `Overdue: ${amount} owed to ${payerName}`,
      message: `${payerName} paid ${amount} for "${expenseName}" ${daysOutstanding} days ago. This needs to be settled immediately.`,
    };
  }
  if (daysOutstanding <= 25) {
    return {
      title: `OVERDUE: Pay ${payerName} ${amount}`,
      message: `${daysOutstanding} days overdue. ${payerName} paid ${amount} for "${expenseName}". Stop ignoring this — settle now.`,
    };
  }
  return {
    title: `URGENT: ${daysOutstanding} days overdue`,
    message: `You owe ${payerName} ${amount} for "${expenseName}". This is ${daysOutstanding} days overdue. Settle immediately.`,
  };
};

export async function checkPaymentReminders() {
  try {
    const now = new Date();

    const unsettledParticipants = await db.expenseParticipant.findMany({
      where: {
        settledAt: null,
        amount: { not: 0n },
        expense: {
          deletedAt: null,
          splitType: { not: SplitType.SETTLEMENT },
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        expense: {
          select: {
            id: true,
            name: true,
            amount: true,
            currency: true,
            createdAt: true,
            paidBy: true,
            paidByUser: { select: { name: true, email: true } },
          },
        },
      },
    });

    await Promise.all(
      unsettledParticipants.map(async (participant) => {
        const { expense, user } = participant;

        // Skip if participant is the payer
        if (user.id === expense.paidBy) {
          return;
        }

        const msElapsed = now.getTime() - expense.createdAt.getTime();
        const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));

        const dayOffset = getReminderDayOffset(daysElapsed);
        if (dayOffset === null) {
          return;
        }

        // Check if reminder already sent for this day offset
        const existing = await db.paymentReminder.findUnique({
          where: {
            expenseId_userId_dayOffset: {
              expenseId: expense.id,
              userId: user.id,
              dayOffset,
            },
          },
        });
        if (existing) {
          return;
        }

        const { toUIString } = getCurrencyHelpers({
          currency: isCurrencyCode(expense.currency) ? expense.currency : 'USD',
        });
        const amountStr = toUIString(expense.amount);
        const payerName = expense.paidByUser?.name ?? expense.paidByUser?.email ?? 'Someone';

        const pushContent = getReminderContent(payerName, expense.name, amountStr, daysElapsed);

        // Send push notification
        await sendPushNotificationToUsers([user.id], {
          ...pushContent,
          data: { url: `/expenses/${expense.id}` },
        });

        // Send email on day 10+
        if (daysElapsed >= 10 && user.email) {
          const appUrl = process.env.NEXTAUTH_URL ?? '';
          await sendPaymentReminderEmail(user.email, {
            recipientName: user.name ?? user.email,
            payerName,
            expenseName: expense.name,
            amount: amountStr,
            expenseUrl: `${appUrl}/expenses/${expense.id}`,
            daysOutstanding: daysElapsed,
          });
        }

        // Record reminder sent
        await db.paymentReminder.create({
          data: {
            expenseId: expense.id,
            userId: user.id,
            dayOffset,
          },
        });
      }),
    );
  } catch (e) {
    console.error('Error checking payment reminders', e);
  } finally {
    // Re-check every hour
    setTimeout(checkPaymentReminders, 1000 * 60 * 60);
  }
}

async function sendBillReminderNotificationOnce(
  billReminderId: number,
  userId: number,
  dayOffset: number,
  pushData: PushMessage,
) {
  try {
    await db.billReminderNotification.create({ data: { billReminderId, userId, dayOffset } });
  } catch {
    // Unique constraint violation = already sent for this cycle, skip.
    return;
  }
  await sendPushNotificationToUsers([userId], pushData);
}

/**
 * Debug-only: fires a real push through the same sendPushNotificationToUsers
 * pipeline and the same copy generator checkBillReminderNotifications uses,
 * against a genuine reminder the caller owns/is part of — bypassing the
 * day-count/threshold gate so it fires immediately. Never fabricates reminder
 * data; throws if the reminder doesn't exist or isn't visible to the caller.
 */
export async function sendBillReminderTestNotification(
  billReminderId: number,
  requestorId: number,
) {
  const reminder = await db.billReminder.findUnique({
    where: { id: billReminderId },
    include: { group: { select: { id: true, name: true } }, members: true },
  });

  if (!reminder) {
    throw new Error('Reminder not found');
  }
  const isVisible =
    reminder.createdBy === requestorId || reminder.members.some((m) => m.userId === requestorId);
  if (!isVisible) {
    throw new Error('Reminder not visible to this user');
  }

  const message =
    reminder.groupId === null || !reminder.group
      ? PERSONAL_DUE_TODAY_COPY(reminder.title)
      : reminder.createdBy === requestorId
        ? CREATOR_PROMPT_COPY[3]!(reminder.title, reminder.group.name)
        : MEMBER_NOTICE_COPY[3]!(reminder.title, reminder.group.name);

  return sendPushNotificationToUsers([requestorId], {
    title: 'Bill Reminder (test)',
    message,
    data: { url: reminder.groupId ? `/groups/${reminder.groupId}` : '/account' },
  });
}

export async function checkBillReminderNotifications() {
  try {
    await refreshOverdueStatuses();

    const reminders = await db.billReminder.findMany({
      where: { status: { in: [BillReminderStatus.UPCOMING, BillReminderStatus.PAST_DUE] } },
      include: {
        group: { select: { id: true, name: true } },
        members: true,
        creator: { select: { id: true } },
      },
    });

    const now = new Date();

    await Promise.all(
      reminders.map(async (reminder) => {
        const daysLeft = daysUntil(reminder.dueDate, now);

        if (reminder.groupId === null || !reminder.group) {
          // Personal reminder: creator only, on the due date itself.
          if (daysLeft === 0) {
            await sendBillReminderNotificationOnce(reminder.id, reminder.createdBy, 0, {
              title: 'Bill Reminder',
              message: PERSONAL_DUE_TODAY_COPY(reminder.title),
              data: { url: '/account' },
            });
          }
          return;
        }

        const groupName = reminder.group.name;
        const url = `/groups/${reminder.groupId}`;

        if (CREATOR_THRESHOLDS.includes(daysLeft)) {
          const copyFn = CREATOR_PROMPT_COPY[daysLeft]!;
          await sendBillReminderNotificationOnce(reminder.id, reminder.createdBy, daysLeft, {
            title: 'Bill Reminder',
            message: copyFn(reminder.title, groupName),
            data: { url },
          });
        }

        if (MEMBER_THRESHOLDS.includes(daysLeft)) {
          const copyFn = MEMBER_NOTICE_COPY[daysLeft]!;
          const otherMembers = reminder.members.filter((m) => m.userId !== reminder.createdBy);
          await Promise.all(
            otherMembers.map((member) =>
              sendBillReminderNotificationOnce(
                reminder.id,
                member.userId,
                // Member and creator dedupe keys share the same [billReminderId, userId, dayOffset]
                // Space; creator/member never overlap for a given userId since a creator's own
                // Notifications use CREATOR_THRESHOLDS/CREATOR_OVERDUE_THRESHOLDS offsets
                // Exclusively.
                memberNoticeDayOffset(daysLeft),
                {
                  title: 'Bill Reminder',
                  message: copyFn(reminder.title, groupName),
                  data: { url },
                },
              ),
            ),
          );
        }

        // Overdue nudge: creator only, only while unresolved (status stays PAST_DUE
        // Until amount entered or cycle skipped — see refreshOverdueStatuses).
        if (reminder.status === BillReminderStatus.PAST_DUE) {
          const daysOverdue = -daysLeft;
          if (CREATOR_OVERDUE_THRESHOLDS.includes(daysOverdue)) {
            const copyFn = CREATOR_OVERDUE_COPY[daysOverdue]!;
            await sendBillReminderNotificationOnce(
              reminder.id,
              reminder.createdBy,
              creatorOverdueDayOffset(daysOverdue),
              {
                title: 'Bill Reminder',
                message: copyFn(reminder.title, groupName),
                data: { url },
              },
            );
          }
        }
      }),
    );
  } catch (e) {
    console.error('Error checking bill reminder notifications', e);
  } finally {
    // Re-check daily
    setTimeout(checkBillReminderNotifications, 1000 * 60 * 60 * 24);
  }
}
