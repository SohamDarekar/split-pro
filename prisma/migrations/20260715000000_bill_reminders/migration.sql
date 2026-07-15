-- CreateEnum
CREATE TYPE "public"."BillReminderStatus" AS ENUM ('UPCOMING', 'PAST_DUE', 'NEEDS_NEXT_DATE', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."BillReminder" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "groupId" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "status" "public"."BillReminderStatus" NOT NULL DEFAULT 'UPCOMING',
    "expenseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillReminderMember" (
    "billReminderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "BillReminderMember_pkey" PRIMARY KEY ("billReminderId","userId")
);

-- CreateTable
CREATE TABLE "public"."BillReminderNotification" (
    "billReminderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillReminderNotification_pkey" PRIMARY KEY ("billReminderId","userId","dayOffset")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillReminder_expenseId_key" ON "public"."BillReminder"("expenseId");

-- CreateIndex
CREATE INDEX "BillReminder_groupId_idx" ON "public"."BillReminder"("groupId");

-- CreateIndex
CREATE INDEX "BillReminder_createdBy_idx" ON "public"."BillReminder"("createdBy");

-- CreateIndex
CREATE INDEX "BillReminder_dueDate_idx" ON "public"."BillReminder"("dueDate");

-- AddForeignKey
ALTER TABLE "public"."BillReminder" ADD CONSTRAINT "BillReminder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillReminder" ADD CONSTRAINT "BillReminder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillReminder" ADD CONSTRAINT "BillReminder_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillReminderMember" ADD CONSTRAINT "BillReminderMember_billReminderId_fkey" FOREIGN KEY ("billReminderId") REFERENCES "public"."BillReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillReminderMember" ADD CONSTRAINT "BillReminderMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillReminderNotification" ADD CONSTRAINT "BillReminderNotification_billReminderId_fkey" FOREIGN KEY ("billReminderId") REFERENCES "public"."BillReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillReminderNotification" ADD CONSTRAINT "BillReminderNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
