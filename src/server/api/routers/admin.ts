import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, createTRPCRouter } from '~/server/api/trpc';
import { db } from '~/server/db';
import { sendSignUpEmail } from '~/server/mailer';
import { env } from '~/env';
import { getBaseUrl } from '~/utils/api';

export const adminRouter = createTRPCRouter({
  getStats: adminProcedure.query(async () => {
    const [userCount, groupCount, expenseCount, totalExpenseAmount] = await Promise.all([
      db.user.count({ where: { email: { not: null } } }),
      db.group.count(),
      db.expense.count({ where: { deletedAt: null } }),
      db.expense.aggregate({
        where: { deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const recentUsers = await db.user.findMany({
      where: { email: { not: null } },
      orderBy: { id: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, image: true },
    });

    const recentExpenses = await db.expense.findMany({
      where: { deletedAt: null },
      orderBy: { expenseDate: 'desc' },
      take: 5,
      include: { paidByUser: { select: { name: true, email: true } } },
    });

    return {
      userCount,
      groupCount,
      expenseCount,
      totalExpenseAmount: totalExpenseAmount._sum.amount ?? 0n,
      recentUsers,
      recentExpenses,
    };
  }),

  getUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      const { search, page, pageSize } = input;
      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isAdmin: true,
            emailVerified: true,
            currency: true,
            _count: { select: { addedExpenses: true, associatedGroups: true } },
          },
        }),
        db.user.count({ where }),
      ]);

      return { users, total, page, pageSize };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete yourself' });
      }
      await db.user.delete({ where: { id: input.userId } });
      return { success: true };
    }),

  toggleAdmin: adminProcedure
    .input(z.object({ userId: z.number(), isAdmin: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot modify your own admin status',
        });
      }
      await db.user.update({ where: { id: input.userId }, data: { isAdmin: input.isAdmin } });
      return { success: true };
    }),

  getGroups: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      const { search, page, pageSize } = input;
      const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};

      const [groups, total] = await Promise.all([
        db.group.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            _count: { select: { expenses: true, groupUsers: true } },
            createdBy: { select: { name: true, email: true } },
          },
        }),
        db.group.count({ where }),
      ]);

      return { groups, total, page, pageSize };
    }),

  deleteGroup: adminProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ input }) => {
      await db.group.delete({ where: { id: input.groupId } });
      return { success: true };
    }),

  getExpenses: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      const { search, page, pageSize } = input;
      const where = {
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      };

      const [expenses, total] = await Promise.all([
        db.expense.findMany({
          where,
          orderBy: { expenseDate: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            paidByUser: { select: { name: true, email: true } },
            group: { select: { name: true } },
            expenseParticipants: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        }),
        db.expense.count({ where }),
      ]);

      return { expenses, total, page, pageSize };
    }),

  deleteExpense: adminProcedure
    .input(z.object({ expenseId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.expense.update({
        where: { id: input.expenseId },
        data: { deletedAt: new Date(), deletedBy: ctx.session.user.id },
      });
      return { success: true };
    }),

  getPendingInvites: adminProcedure.query(async () => {
    const tokens = await db.verificationToken.findMany({
      where: { expires: { gt: new Date() } },
      orderBy: { expires: 'asc' },
    });

    const invitedUsers = await db.user.findMany({
      where: {
        email: { in: tokens.map((t) => t.identifier) },
        emailVerified: null,
      },
      select: { id: true, name: true, email: true },
    });

    return { tokens, invitedUsers };
  }),

  resendVerification: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const token = Math.random().toString(36).substring(2, 7).toLowerCase();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.verificationToken.deleteMany({ where: { identifier: input.email } });
      await db.verificationToken.create({
        data: { identifier: input.email, token, expires },
      });

      const url = `${getBaseUrl()}/api/auth/callback/email?callbackUrl=${encodeURIComponent(getBaseUrl())}&token=${token}&email=${encodeURIComponent(input.email)}`;
      await sendSignUpEmail(input.email, url, token);

      return { success: true };
    }),

  getSettings: adminProcedure.query(async () => {
    const registrationsDisabled = await db.appMetadata.findUnique({
      where: { key: 'registrations_disabled' },
    });

    return {
      registrationsDisabled: registrationsDisabled?.value === 'true',
      inviteOnly: env.INVITE_ONLY,
      disableEmailSignup: env.DISABLE_EMAIL_SIGNUP,
    };
  }),

  setRegistrationsDisabled: adminProcedure
    .input(z.object({ disabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.appMetadata.upsert({
        where: { key: 'registrations_disabled' },
        update: { value: input.disabled ? 'true' : 'false' },
        create: { key: 'registrations_disabled', value: input.disabled ? 'true' : 'false' },
      });
      return { success: true };
    }),

  forceSettleBalance: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        friendId: z.number(),
        currency: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      // Settle all unsettled expense participants between these two users for the given currency
      await db.expenseParticipant.updateMany({
        where: {
          settledAt: null,
          userId: input.userId,
          expense: {
            currency: input.currency,
            deletedAt: null,
            OR: [
              { paidBy: input.friendId },
              { expenseParticipants: { some: { userId: input.friendId } } },
            ],
          },
        },
        data: { settledAt: now },
      });
      await db.expenseParticipant.updateMany({
        where: {
          settledAt: null,
          userId: input.friendId,
          expense: {
            currency: input.currency,
            deletedAt: null,
            OR: [
              { paidBy: input.userId },
              { expenseParticipants: { some: { userId: input.userId } } },
            ],
          },
        },
        data: { settledAt: now },
      });
      return { success: true };
    }),

  getUserBalances: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const balances = await db.balanceView.findMany({
        where: { userId: input.userId, amount: { not: 0n } },
        include: { friend: { select: { id: true, name: true, email: true } } },
      });
      return balances;
    }),
});
