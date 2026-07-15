import { BillReminderStatus } from '@prisma/client';
import { Bell, Repeat } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AccountButton } from '~/components/Account/AccountButton';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '~/components/ui/drawer';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { api } from '~/utils/api';
import { CurrencyInput } from '~/components/ui/currency-input';

interface ReminderListItem {
  id: number;
  title: string;
  dueDate: Date | string;
  isRecurring: boolean;
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

export const BillReminders: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <AccountButton>
          <Bell className="size-5 text-purple-500" />
          Bill Reminders
        </AccountButton>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Bill Reminders</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <BillReminderList />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

const BillReminderList: React.FC = () => {
  const listQuery = api.billReminder.list.useQuery();
  const { toUIDate } = useTranslationWithUtils();

  const reminders = useMemo(
    () => (listQuery.data ?? []) as unknown as ReminderListItem[],
    [listQuery.data],
  );

  return (
    <div className="flex flex-col gap-3">
      <CreateBillReminderDrawer />

      {listQuery.isPending && <div className="text-muted-foreground text-sm">Loading…</div>}

      {reminders.map((reminder) => (
        <BillReminderRow key={reminder.id} reminder={reminder} toUIDate={toUIDate} />
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
}> = ({ reminder, toUIDate }) => {
  const utils = api.useUtils();
  const [detailOpen, setDetailOpen] = useState(false);
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

  const isPastDueRecurring =
    reminder.status === BillReminderStatus.PAST_DUE && reminder.isRecurring;
  const isPastDueNonRecurring =
    reminder.status === BillReminderStatus.PAST_DUE && !reminder.isRecurring;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <button className="flex flex-col items-start text-left" onClick={() => setDetailOpen(true)}>
        <div className="flex items-center gap-2 font-medium">
          {reminder.title}
          {reminder.isRecurring && <Repeat className="text-muted-foreground size-3.5" />}
        </div>
        <div className="text-muted-foreground text-xs">
          {toUIDate(new Date(reminder.dueDate), { useToday: true })} ·{' '}
          {reminder.group ? reminder.group.name : 'Personal'} · {statusLabel[reminder.status]}
        </div>
      </button>

      <div className="flex items-center gap-2">
        {reminder.status === BillReminderStatus.NEEDS_NEXT_DATE && (
          <NextDueDateButton reminderId={reminder.id} />
        )}

        {isPastDueRecurring && (
          <>
            <Button size="sm" variant="outline" onClick={() => setDetailOpen(true)}>
              Enter amount
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-orange-600"
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
            className="text-orange-600"
            onClick={() => deleteMutation.mutate({ id: reminder.id })}
          >
            Dismiss
          </Button>
        )}
      </div>

      <BillReminderDetailDrawer
        reminder={reminder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};

const NextDueDateButton: React.FC<{ reminderId: number }> = ({ reminderId }) => {
  const utils = api.useUtils();
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(false);
  const mutation = api.billReminder.setNextDueDate.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      setOpen(false);
      toast.success('Next due date set');
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Update due date
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 w-36"
      />
      <Button
        size="sm"
        disabled={!date}
        onClick={() => mutation.mutate({ id: reminderId, dueDate: new Date(date) })}
      >
        Save
      </Button>
    </div>
  );
};

const CreateBillReminderDrawer: React.FC = () => {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>([]);

  const groupsQuery = api.group.getAllGroups.useQuery(undefined, { enabled: open });
  const groupDetailsQuery = api.group.getGroupDetails.useQuery(
    { groupId: groupId! },
    { enabled: open && groupId !== null },
  );

  const createMutation = api.billReminder.create.useMutation({
    onSuccess: () => {
      utils.billReminder.list.invalidate().catch(console.error);
      toast.success('Reminder created');
      setOpen(false);
      setTitle('');
      setDueDate('');
      setIsRecurring(false);
      setGroupId(null);
      setMemberIds([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const groupMembers = groupDetailsQuery.data?.groupUsers ?? [];

  const toggleMember = (userId: number) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const canSubmit =
    title.trim().length > 0 && dueDate.length > 0 && (groupId === null || memberIds.length > 0);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">New Reminder</Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>New Bill Reminder</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Electricity bill"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Due date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Personal or group?</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={groupId === null ? 'default' : 'outline'}
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
                <select
                  className="border-input rounded-md border bg-transparent p-2"
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(Number(e.target.value));
                    setMemberIds([]);
                  }}
                >
                  {groupsQuery.data?.map((gu) => (
                    <option key={gu.group.id} value={gu.group.id}>
                      {gu.group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Split between</label>
                {groupMembers.map((gu) => (
                  <label key={gu.userId} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={memberIds.includes(gu.userId)}
                      onCheckedChange={() => toggleMember(gu.userId)}
                    />
                    {gu.user.name ?? gu.user.email}
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Recurring (repeats on an inconsistent cycle)
            </span>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
        </div>
        <DrawerFooter>
          <Button
            disabled={!canSubmit || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                title: title.trim(),
                dueDate: new Date(dueDate),
                isRecurring,
                groupId,
                memberIds,
              })
            }
          >
            Create
          </Button>
          <DrawerClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

const BillReminderDetailDrawer: React.FC<{
  reminder: ReminderListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ reminder, open, onOpenChange }) => {
  const utils = api.useUtils();
  const [memberIds, setMemberIds] = useState<number[]>(reminder.members.map((m) => m.userId));
  const [amount, setAmount] = useState<bigint>(0n);
  const [amountStr, setAmountStr] = useState('');
  // Bill reminders don't store an amount/currency (spec: amount only exists at entry time).
  // No reliable currency resolution exists at expense-creation time anywhere else in the app
  // Either — Group.defaultCurrency is never read into the add-expense flow, and the client
  // Store (src/store/addStore.ts) hardcodes 'AUD' the same way. Matching that convention here.
  // Fixed default, not derived — revisit if reminders ever get multi-currency support.
  const currency = 'AUD';

  const groupDetailsQuery = api.group.getGroupDetails.useQuery(
    { groupId: reminder.groupId! },
    { enabled: open && reminder.groupId !== null },
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
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const groupMembers = groupDetailsQuery.data?.groupUsers ?? [];

  const toggleMember = (userId: number) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const showAmountEntry =
    reminder.groupId !== null &&
    (reminder.status === BillReminderStatus.UPCOMING ||
      reminder.status === BillReminderStatus.PAST_DUE);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{reminder.title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          {reminder.groupId !== null && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Split between</label>
              {groupMembers.map((gu) => (
                <label key={gu.userId} className="flex items-center gap-2 py-1">
                  <Checkbox
                    checked={memberIds.includes(gu.userId)}
                    onCheckedChange={() => toggleMember(gu.userId)}
                  />
                  {gu.user.name ?? gu.user.email}
                </label>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="mt-1 w-fit"
                disabled={memberIds.length === 0}
                onClick={() => updateMembersMutation.mutate({ id: reminder.id, memberIds })}
              >
                Save member selection
              </Button>
            </div>
          )}

          {showAmountEntry && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Enter bill amount</label>
              <CurrencyInput
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
                className="mt-2"
                disabled={amount <= 0n || submitAmountMutation.isPending}
                onClick={() => submitAmountMutation.mutate({ id: reminder.id, amount, currency })}
              >
                Split with {reminder.group?.name}
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
