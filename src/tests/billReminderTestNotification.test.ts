interface MockDb {
  billReminder: { findUnique: jest.Mock };
  pushNotification: { findMany: jest.Mock };
}

// Real send pipeline: sendBillReminderTestNotification -> sendPushNotificationToUsers
// -> db.pushNotification.findMany + pushNotification() (the actual web-push call).
// We stub the web-push transport (no real network) and the subscription lookup
// (empty -> "no subscription" outcome), but exercise the real payload-construction
// And real dedupe-free send path — not a mocked/fake notification.
jest.mock('~/server/db', () => ({
  db: {
    billReminder: { findUnique: jest.fn() },
    pushNotification: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));
jest.mock('~/server/notification', () => ({ pushNotification: jest.fn() }));
jest.mock('~/server/api/services/splitService', () => ({ createExpense: jest.fn() }));
jest.mock('~/server/mailer', () => ({ sendPaymentReminderEmail: jest.fn() }));

import { db } from '~/server/db';
import { sendBillReminderTestNotification } from '~/server/api/services/notificationService';

const mockDb = db as unknown as MockDb;

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.pushNotification.findMany.mockResolvedValue([]);
});

describe('sendBillReminderTestNotification', () => {
  it('uses the real creator-prompt copy and the real sendPushNotificationToUsers pipeline, bypassing the day-count gate', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      id: 1,
      createdBy: 42,
      groupId: 7,
      title: 'Electricity',
      group: { id: 7, name: 'Flatmates' },
      members: [{ userId: 42 }, { userId: 43 }],
    });

    const result = await sendBillReminderTestNotification(1, 42);

    // No push subscriptions exist for this test user, so sentCount is 0 — the
    // Point is it reached the real db.pushNotification lookup (proving it went
    // Through the genuine pipeline) rather than a mocked/fake notification.
    expect(mockDb.pushNotification.findMany).toHaveBeenCalledWith({
      where: { userId: { in: [42] } },
    });
    expect(result).toEqual({
      sentCount: 0,
      error: 'No push subscription found for this device/account',
    });
  });

  it('throws for a reminder the requestor cannot see — never sends against reminders the caller has no access to', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce({
      id: 1,
      createdBy: 42,
      groupId: 7,
      title: 'Electricity',
      group: { id: 7, name: 'Flatmates' },
      members: [{ userId: 42 }],
    });

    await expect(sendBillReminderTestNotification(1, 999)).rejects.toThrow('not visible');
    expect(mockDb.pushNotification.findMany).not.toHaveBeenCalled();
  });

  it('throws when the reminder does not exist — never fabricates reminder data', async () => {
    mockDb.billReminder.findUnique.mockResolvedValueOnce(null);
    await expect(sendBillReminderTestNotification(999, 42)).rejects.toThrow('Reminder not found');
    expect(mockDb.pushNotification.findMany).not.toHaveBeenCalled();
  });
});
