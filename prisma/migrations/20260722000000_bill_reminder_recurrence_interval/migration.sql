-- CreateEnum
CREATE TYPE "public"."RecurrenceInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');

-- Replace boolean isRecurring with an interval. Existing isRecurring=true rows
-- have no interval data to backfill from (the old model never captured one),
-- so they fall back to MONTHLY as the least-surprising default; isRecurring=false
-- rows become non-recurring (recurrenceInterval NULL), matching prior behavior.
ALTER TABLE "public"."BillReminder" ADD COLUMN "recurrenceInterval" "public"."RecurrenceInterval";
ALTER TABLE "public"."BillReminder" ADD COLUMN "customIntervalDays" INTEGER;

UPDATE "public"."BillReminder" SET "recurrenceInterval" = 'MONTHLY' WHERE "isRecurring" = true;

ALTER TABLE "public"."BillReminder" DROP COLUMN "isRecurring";
