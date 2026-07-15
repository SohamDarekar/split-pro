import { RecurrenceInterval } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { db } from '~/server/db';
import { DEFAULT_CATEGORY } from '~/lib/category';
import {
  createBillReminder,
  deleteBillReminder,
  setNextDueDate,
  skipBillReminderCycle,
  submitBillReminderAmount,
  updateBillReminderMembers,
} from '../services/billReminderService';
import { sendBillReminderTestNotification } from '../services/notificationService';

const createBillReminderSchema = z
  .object({
    title: z.string().min(1),
    dueDate: z.date(),
    recurrenceInterval: z.nativeEnum(RecurrenceInterval).nullable(),
    customIntervalDays: z.number().int().positive().nullable(),
    groupId: z.number().nullable(),
    memberIds: z.array(z.number()),
  })
  .refine((v) => v.groupId === null || v.memberIds.length > 0, {
    message: 'Select at least one member to split the bill between',
    path: ['memberIds'],
  })
  .refine(
    (v) => v.recurrenceInterval !== RecurrenceInterval.CUSTOM || v.customIntervalDays !== null,
    {
      message: 'Enter how many days between reminders',
      path: ['customIntervalDays'],
    },
  )
  .refine(
    (v) => v.recurrenceInterval === RecurrenceInterval.CUSTOM || v.customIntervalDays === null,
    {
      message: 'customIntervalDays only applies to Custom recurrence',
      path: ['customIntervalDays'],
    },
  );

export const billReminderRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return db.billReminder.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { groupId: null, createdBy: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        group: { select: { id: true, name: true } },
        members: { include: { user: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const reminder = await db.billReminder.findUnique({
      where: { id: input.id },
      include: { group: true, members: { include: { user: true } } },
    });
    if (!reminder) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Reminder not found' });
    }
    const isVisible =
      reminder.createdBy === ctx.session.user.id ||
      reminder.members.some((m) => m.userId === ctx.session.user.id);
    if (!isVisible) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not visible to this user' });
    }
    return reminder;
  }),

  create: protectedProcedure.input(createBillReminderSchema).mutation(async ({ input, ctx }) => {
    try {
      return await createBillReminder({ ...input, createdBy: ctx.session.user.id });
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'Failed to create reminder',
      });
    }
  }),

  updateMembers: protectedProcedure
    .input(z.object({ id: z.number(), memberIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await updateBillReminderMembers(input.id, ctx.session.user.id, input.memberIds);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to update members',
        });
      }
    }),

  setNextDueDate: protectedProcedure
    .input(z.object({ id: z.number(), dueDate: z.date() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await setNextDueDate(input.id, ctx.session.user.id, input.dueDate);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to set next due date',
        });
      }
    }),

  skipCycle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await skipBillReminderCycle(input.id, ctx.session.user.id);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to skip this cycle',
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await deleteBillReminder(input.id, ctx.session.user.id);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to delete reminder',
        });
      }
    }),

  sendTestNotification: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await sendBillReminderTestNotification(input.id, ctx.session.user.id);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to send test notification',
        });
      }
    }),

  submitAmount: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        amount: z.bigint(),
        currency: z.string(),
        category: z.string().default(DEFAULT_CATEGORY),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await submitBillReminderAmount(
          input.id,
          ctx.session.user.id,
          input.amount,
          input.currency,
          input.category,
        );
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to submit amount',
        });
      }
    }),
});
