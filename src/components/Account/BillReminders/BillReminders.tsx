import { BillReminderStatus, RecurrenceInterval } from '@prisma/client';
import { ChevronLeftIcon, Repeat } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DateSelector } from '~/components/AddExpense/DateSelector';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { CurrencyInput } from '~/components/ui/currency-input';
import { Input } from '~/components/ui/input';
import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { api } from '~/utils/api';

interface ReminderListItem {
  id: number;
  title: string;
  dueDate: Date | string;
  recurrenceInterval: RecurrenceInterval | null;
  customIntervalDays: number | null;
  status: BillReminderStatus;
  groupId: number | null;
  createdBy: number;
  group: { id: number; name: string } | null;
  members: { userId: number; user: { name: string | null; email: string | null } }[];
}

const statusLabel: Record<BillReminderStatus, string> = {
  UPCOMING: 'Upcoming',
  PAST_DUE: 'Past due',
  NEEDS_NEXT_DATE: 'Needs next date',
  COMPLETED: 'Completed',
};

const RECURRENCE_LABEL: Record<RecurrenceInterval, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
};

// PWA note: iOS Safari auto-zooms on focus when a focused input's computed
// Font-size is under 16px. Fixed at the source here (text-base = 16px, only
// Stepping down to text-sm on sm:+ desktop viewports) rather than via
// User-scalable=no/maximum-scale=1 on the viewport meta tag, which would
// Disable pinch-zoom accessibility app-wide. Scoped to this feature's inputs
// Since no site-wide convention exists yet to extend instead (see ui/input.tsx,
// Ui/native-select.tsx — both still default to text-sm).
export const MOBILE_SAFE_TEXT = 'text-base sm:text-sm';
// Prevents accidental double-tap-to-zoom on interactive elements without
// Touching the global viewport zoom/pinch behavior.
export const TOUCH_TARGET = 'touch-manipulation min-h-11';

type PageView = { kind: 'list' } | { kind: 'create' } | { kind: 'detail'; reminderId: number };

/**
 * Full-page Bill Reminders UI (src/pages/account/bill-reminders.tsx). Previously
 * a vaul Drawer (bottom sheet) off the Account tab — moved off Drawer entirely,
 * not just visually: the broken date picker was caused by DateSelector's Radix
 * Popover being nested inside a vaul Drawer, where the two portal/overlay
 * libraries fought over the same iOS touch event, so taps on a calendar day
 * landed on the Drawer's overlay instead of the day button and onSelect never
 * fired. Un-nesting removes the mechanism, not just the symptom. List/create/
 * detail are now page-level states (no modal anywhere) so the same class of
 * bug can't recur here.
 */
export const BillRemindersContent: React.FC = () => {
  const [view, setView] = useState<PageView>({ kind: 'list' });

  if (view.kind === 'create') {
    return <CreateBillReminderView onDone={() => setView({ kind: 'list' })} />;
  }

  if (view.kind === 'detail') {
    return (
      <BillReminderDetailView
        reminderId={view.reminderId}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <BillReminderListView
      onCreate={() => setView({ kind: 'create' })}
      onOpenDetail={(reminderId) => setView({ kind: 'detail', reminderId })}
    />
  );
};

const BillReminderListView: React.FC<{
  onCreate: () => void;
  onOpenDetail: (reminderId: number) => void;
}> = ({ onCreate, onOpenDetail }) => {
  const listQuery = api.billReminder.list.useQuery();
  const { toUIDate } = useTranslationWithUtils();

  const reminders = useMemo(
    () => (listQuery.data ?? []) as unknown as ReminderListItem[],
    [listQuery.data],
  );

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" className={TOUCH_TARGET} onClick={onCreate}>
        New Reminder
      </Button>

      {listQuery.isPending && <div className="text-muted-foreground text-sm">Loading…</div>}

      {reminders.map((reminder) => (
        <BillReminderRow
          key={reminder.id}
          reminder={reminder}
          toUIDate={toUIDate}
          onOpenDetail={() => onOpenDetail(reminder.id)}
        />
      ))}

      {!listQuery.isPending && reminders.length === 0 && (
        <div className="text-muted-foreground text-sm">No bill reminders yet.</div>
      )}
    </div>
  );
};

const BillReminderRow: React.FC<{
  reminder: ReminderListItem;
  toUIDate: ReturnType<typeof useTranslationWithUtils>['toUIDate'];
  onOpenDetail: () => void;
}> = ({ reminder, toUIDate, onOpenDetail }) => {
  const utils = api.useUtils();
  const deleteMutation = api.billReminder.delete.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      toast.success('Reminder deleted');
    },
    onError: (e) => toast.error(e.message),
  });
  const skipCycleMutation = api.billReminder.skipCycle.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      toast.success('Cycle skipped');
    },
    onError: (e) => toast.error(e.message),
  });

  const isRecurring = reminder.recurrenceInterval !== null;
  const isPastDueRecurring = reminder.status === BillReminderStatus.PAST_DUE && isRecurring;
  const isPastDueNonRecurring = reminder.status === BillReminderStatus.PAST_DUE && !isRecurring;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <button
        className={`flex flex-col items-start text-left ${TOUCH_TARGET}`}
        onClick={onOpenDetail}
      >
        <div className="flex items-center gap-2 font-medium">
          {reminder.title}
          {isRecurring && <Repeat className="text-muted-foreground size-3.5" />}
        </div>
        <div className="text-muted-foreground text-xs">
          {toUIDate(new Date(reminder.dueDate), { useToday: true })} ·{' '}
          {reminder.group ? reminder.group.name : 'Personal'} · {statusLabel[reminder.status]}
        </div>
      </button>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {reminder.status === BillReminderStatus.NEEDS_NEXT_DATE && (
          <NextDueDateField reminderId={reminder.id} />
        )}

        {isPastDueRecurring && (
          <>
            <Button size="sm" variant="outline" className={TOUCH_TARGET} onClick={onOpenDetail}>
              Enter amount
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`text-orange-600 ${TOUCH_TARGET}`}
              disabled={skipCycleMutation.isPending}
              onClick={() => skipCycleMutation.mutate({ id: reminder.id })}
            >
              Skip this cycle
            </Button>
          </>
        )}

        {isPastDueNonRecurring && (
          <Button
            size="sm"
            variant="ghost"
            className={`text-orange-600 ${TOUCH_TARGET}`}
            onClick={() => deleteMutation.mutate({ id: reminder.id })}
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
};

const NextDueDateField: React.FC<{ reminderId: number }> = ({ reminderId }) => {
  const utils = api.useUtils();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const mutation = api.billReminder.setNextDueDate.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      setEditing(false);
      toast.success('Next due date set');
    },
    onError: (e) => toast.error(e.message),
  });

  if (!editing) {
    return (
      <Button size="sm" variant="outline" className={TOUCH_TARGET} onClick={() => setEditing(true)}>
        Update due date
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <DateSelector mode="single" required selected={date} onSelect={setDate} />
      <Button
        size="sm"
        className={TOUCH_TARGET}
        disabled={!date}
        onClick={() => date && mutation.mutate({ id: reminderId, dueDate: date })}
      >
        Save
      </Button>
    </div>
  );
};

const CreateBillReminderView: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const utils = api.useUtils();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval | null>(null);
  const [customIntervalDays, setCustomIntervalDays] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>([]);

  const groupsQuery = api.group.getAllGroups.useQuery();
  const groupDetailsQuery = api.group.getGroupDetails.useQuery(
    { groupId: groupId! },
    { enabled: groupId !== null },
  );

  const createMutation = api.billReminder.create.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      toast.success('Reminder created');
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const groupMembers = groupDetailsQuery.data?.groupUsers ?? [];

  const toggleMember = (userId: number) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const customDaysNum = Number(customIntervalDays);
  const customDaysValid =
    recurrenceInterval !== RecurrenceInterval.CUSTOM ||
    (customIntervalDays.length > 0 && Number.isInteger(customDaysNum) && customDaysNum > 0);

  const canSubmit =
    title.trim().length > 0 &&
    dueDate !== undefined &&
    (groupId === null || memberIds.length > 0) &&
    customDaysValid;

  return (
    <div className="flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
      <button
        className={`text-muted-foreground flex items-center gap-1 text-sm ${TOUCH_TARGET}`}
        onClick={onDone}
      >
        <ChevronLeftIcon className="h-5 w-5" />
        Back to reminders
      </button>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Title</label>
        <Input
          className={MOBILE_SAFE_TEXT}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Electricity bill"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Due date</label>
        <DateSelector mode="single" required selected={dueDate} onSelect={setDueDate} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Personal or group?</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={groupId === null ? 'default' : 'outline'}
            className={TOUCH_TARGET}
            onClick={() => {
              setGroupId(null);
              setMemberIds([]);
            }}
          >
            Personal
          </Button>
          <Button
            size="sm"
            variant={groupId !== null ? 'default' : 'outline'}
            className={TOUCH_TARGET}
            onClick={() => setGroupId(groupsQuery.data?.[0]?.group.id ?? null)}
            disabled={!groupsQuery.data?.length}
          >
            Group
          </Button>
        </div>
      </div>

      {groupId !== null && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Group</label>
            <NativeSelect
              className={MOBILE_SAFE_TEXT}
              value={groupId}
              onChange={(e) => {
                setGroupId(Number(e.target.value));
                setMemberIds([]);
              }}
            >
              {groupsQuery.data?.map((gu) => (
                <NativeSelectOption key={gu.group.id} value={gu.group.id}>
                  {gu.group.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Split between</label>
            {groupMembers.map((gu) => (
              <label key={gu.userId} className={`flex items-center gap-2 ${TOUCH_TARGET}`}>
                <Checkbox
                  className="size-5"
                  checked={memberIds.includes(gu.userId)}
                  onCheckedChange={() => toggleMember(gu.userId)}
                />
                {gu.user.name ?? gu.user.email}
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Recurrence</label>
        <NativeSelect
          className={MOBILE_SAFE_TEXT}
          value={recurrenceInterval ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            const isValidInterval = (Object.values(RecurrenceInterval) as string[]).includes(value);
            setRecurrenceInterval(isValidInterval ? (value as RecurrenceInterval) : null);
            if (value !== RecurrenceInterval.CUSTOM) {
              setCustomIntervalDays('');
            }
          }}
        >
          <NativeSelectOption value="">Not recurring</NativeSelectOption>
          <NativeSelectOption value={RecurrenceInterval.MONTHLY}>Monthly</NativeSelectOption>
          <NativeSelectOption value={RecurrenceInterval.QUARTERLY}>Quarterly</NativeSelectOption>
          <NativeSelectOption value={RecurrenceInterval.HALF_YEARLY}>
            Half-yearly
          </NativeSelectOption>
          <NativeSelectOption value={RecurrenceInterval.YEARLY}>Yearly</NativeSelectOption>
          <NativeSelectOption value={RecurrenceInterval.CUSTOM}>Custom</NativeSelectOption>
        </NativeSelect>
      </div>

      {recurrenceInterval === RecurrenceInterval.CUSTOM && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Repeat every how many days?</label>
          <Input
            className={MOBILE_SAFE_TEXT}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={customIntervalDays}
            onChange={(e) => setCustomIntervalDays(e.target.value)}
            placeholder="e.g. 60"
          />
        </div>
      )}

      <Button
        className={`mt-2 ${TOUCH_TARGET}`}
        disabled={!canSubmit || createMutation.isPending}
        onClick={() =>
          dueDate &&
          createMutation.mutate({
            title: title.trim(),
            dueDate,
            recurrenceInterval,
            customIntervalDays:
              recurrenceInterval === RecurrenceInterval.CUSTOM ? customDaysNum : null,
            groupId,
            memberIds,
          })
        }
      >
        Create
      </Button>
    </div>
  );
};

const BillReminderDetailView: React.FC<{ reminderId: number; onBack: () => void }> = ({
  reminderId,
  onBack,
}) => {
  const utils = api.useUtils();
  const reminderQuery = api.billReminder.get.useQuery({ id: reminderId });
  const reminder = reminderQuery.data as unknown as ReminderListItem | undefined;

  const [memberIds, setMemberIds] = useState<number[] | null>(null);
  const [amount, setAmount] = useState<bigint>(0n);
  const [amountStr, setAmountStr] = useState('');
  // Bill reminders don't store an amount/currency (spec: amount only exists at entry time).
  // No reliable currency resolution exists at expense-creation time anywhere else in the app.
  // Group.defaultCurrency is never read into the add-expense flow, and the client
  // Store (src/store/addStore.ts) hardcodes 'AUD' the same way. Matching that convention here.
  // Fixed default, not derived — revisit if reminders ever get multi-currency support.
  const currency = 'AUD';

  const groupDetailsQuery = api.group.getGroupDetails.useQuery(
    { groupId: reminder?.groupId ?? -1 },
    { enabled: reminder?.groupId !== null && reminder?.groupId !== undefined },
  );

  const updateMembersMutation = api.billReminder.updateMembers.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      toast.success('Members updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const submitAmountMutation = api.billReminder.submitAmount.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      toast.success('Expense created');
      onBack();
    },
    onError: (e) => toast.error(e.message),
  });

  const groupMembers = groupDetailsQuery.data?.groupUsers ?? [];
  const selectedMemberIds = memberIds ?? reminder?.members.map((m) => m.userId) ?? [];

  const toggleMember = (userId: number) => {
    const base = memberIds ?? reminder?.members.map((m) => m.userId) ?? [];
    setMemberIds(base.includes(userId) ? base.filter((id) => id !== userId) : [...base, userId]);
  };

  const showAmountEntry =
    !!reminder &&
    reminder.groupId !== null &&
    (reminder.status === BillReminderStatus.UPCOMING ||
      reminder.status === BillReminderStatus.PAST_DUE);

  return (
    <div className="flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
      <button
        className={`text-muted-foreground flex items-center gap-1 text-sm ${TOUCH_TARGET}`}
        onClick={onBack}
      >
        <ChevronLeftIcon className="h-5 w-5" />
        Back to reminders
      </button>

      {reminderQuery.isPending && <div className="text-muted-foreground text-sm">Loading…</div>}

      {reminder && (
        <>
          <div>
            <div className="text-lg font-medium">{reminder.title}</div>
            {reminder.recurrenceInterval && (
              <p className="text-muted-foreground text-xs">
                Recurs {RECURRENCE_LABEL[reminder.recurrenceInterval].toLowerCase()}
                {reminder.recurrenceInterval === RecurrenceInterval.CUSTOM &&
                  reminder.customIntervalDays &&
                  ` (every ${reminder.customIntervalDays} days)`}
              </p>
            )}
          </div>

          {reminder.groupId !== null && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Split between</label>
              {groupMembers.map((gu) => (
                <label key={gu.userId} className={`flex items-center gap-2 ${TOUCH_TARGET}`}>
                  <Checkbox
                    className="size-5"
                    checked={selectedMemberIds.includes(gu.userId)}
                    onCheckedChange={() => toggleMember(gu.userId)}
                  />
                  {gu.user.name ?? gu.user.email}
                </label>
              ))}
              <Button
                size="sm"
                variant="outline"
                className={`mt-1 w-fit ${TOUCH_TARGET}`}
                disabled={selectedMemberIds.length === 0}
                onClick={() =>
                  updateMembersMutation.mutate({ id: reminder.id, memberIds: selectedMemberIds })
                }
              >
                Save member selection
              </Button>
            </div>
          )}

          {showAmountEntry && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Enter bill amount</label>
              <CurrencyInput
                className={MOBILE_SAFE_TEXT}
                currency={currency}
                strValue={amountStr}
                onValueChange={({
                  strValue,
                  bigIntValue,
                }: {
                  strValue?: string;
                  bigIntValue?: bigint;
                }) => {
                  if (strValue !== undefined) {
                    setAmountStr(strValue);
                  }
                  if (bigIntValue !== undefined) {
                    setAmount(bigIntValue);
                  }
                }}
              />
              <Button
                className={`mt-2 ${TOUCH_TARGET}`}
                disabled={amount <= 0n || submitAmountMutation.isPending}
                onClick={() => submitAmountMutation.mutate({ id: reminder.id, amount, currency })}
              >
                Split with {reminder.group?.name}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
