import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  AdminEmpty,
  AdminLayout,
  AdminList,
  AdminRow,
  AdminSection,
  AdminTextButton,
  ConfirmAction,
} from '~/components/Admin/AdminLayout';
import { getServerAuthSession } from '~/server/auth';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const inputClassName =
  'border-border focus:border-foreground min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm outline-none';

const AdminGroupPage: NextPageWithUser = () => {
  const router = useRouter();
  const groupId = parseInt(router.query.groupId as string);

  const groupQuery = api.admin.getGroup.useQuery({ groupId }, { enabled: !isNaN(groupId) });
  const group = groupQuery.data;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (group) {
      setName(group.name);
    }
  }, [group]);

  const onError = (e: { message: string }) => toast.error(e.message);
  const refetch = () => void groupQuery.refetch();

  const renameGroup = api.admin.renameGroup.useMutation({
    onSuccess: () => {
      toast.success('Group renamed');
      refetch();
    },
    onError,
  });
  const addMember = api.admin.addGroupMember.useMutation({
    onSuccess: () => {
      toast.success('Member added');
      setEmail('');
      refetch();
    },
    onError,
  });
  const removeMember = api.admin.removeGroupMember.useMutation({
    onSuccess: () => {
      toast.success('Member removed');
      refetch();
    },
    onError,
  });
  const setOwner = api.admin.setGroupOwner.useMutation({
    onSuccess: () => {
      toast.success('Owner changed');
      refetch();
    },
    onError,
  });
  const deleteGroup = api.admin.deleteGroup.useMutation({
    onSuccess: () => {
      toast.success('Group deleted');
      router.push('/admin/groups').catch(console.error);
    },
    onError,
  });

  const isBusy =
    renameGroup.isPending || addMember.isPending || removeMember.isPending || setOwner.isPending;

  return (
    <AdminLayout title={group?.name ?? 'Group'} backHref="/admin/groups">
      {groupQuery.isLoading ? <AdminEmpty>Loading…</AdminEmpty> : null}
      {groupQuery.error ? <AdminEmpty>{groupQuery.error.message}</AdminEmpty> : null}

      {group ? (
        <>
          <AdminSection title="Details">
            <AdminList>
              <AdminRow>
                <span>Owner</span>
                <span>{group.createdBy.name ?? group.createdBy.email}</span>
              </AdminRow>
              <AdminRow>
                <span>Expenses</span>
                <span>{group._count.expenses}</span>
              </AdminRow>
              <AdminRow>
                <span>Status</span>
                <span>{group.archivedAt ? 'Archived' : 'Active'}</span>
              </AdminRow>
            </AdminList>
          </AdminSection>

          <AdminSection title="Rename">
            <form
              className="flex gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                renameGroup.mutate({ groupId, name });
              }}
            >
              <input
                className={inputClassName}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <AdminTextButton
                type="submit"
                disabled={isBusy || '' === name.trim() || name === group.name}
              >
                Save
              </AdminTextButton>
            </form>
          </AdminSection>

          <AdminSection title={`Members (${group.groupUsers.length})`}>
            <AdminList>
              {group.groupUsers.map(({ user }) => {
                const isOwner = user.id === group.userId;
                const hasOutstanding = group.outstandingUserIds.includes(user.id);

                return (
                  <AdminRow key={user.id} className="flex-wrap">
                    <div className="min-w-0">
                      <div>
                        {user.name ?? '—'}
                        {isOwner ? <span className="text-muted-foreground"> · owner</span> : null}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {user.email}
                        {hasOutstanding ? ' · has unsettled balance' : ''}
                      </div>
                    </div>
                    {isOwner ? null : (
                      <div className="flex gap-4">
                        <AdminTextButton
                          disabled={isBusy}
                          onClick={() => setOwner.mutate({ groupId, userId: user.id })}
                        >
                          Make owner
                        </AdminTextButton>
                        <ConfirmAction
                          label="Remove"
                          confirmLabel={hasOutstanding ? 'Remove anyway' : 'Confirm remove'}
                          disabled={isBusy}
                          onConfirm={() => removeMember.mutate({ groupId, userId: user.id })}
                        />
                      </div>
                    )}
                  </AdminRow>
                );
              })}
            </AdminList>
            <p className="text-muted-foreground text-xs">
              Removing someone with an unsettled balance keeps their balance on the group&apos;s
              expenses. They stay visible on the group page as a guest.
            </p>
          </AdminSection>

          <AdminSection title="Add member">
            <form
              className="flex gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                addMember.mutate({ groupId, email });
              }}
            >
              <input
                className={inputClassName}
                type="email"
                placeholder="Email of an existing user"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <AdminTextButton type="submit" disabled={isBusy || '' === email.trim()}>
                Add
              </AdminTextButton>
            </form>
          </AdminSection>

          <AdminSection title="Danger zone">
            <AdminList>
              <AdminRow>
                <span className="text-sm">
                  Delete this group and all of its expenses. This can&apos;t be undone.
                </span>
                <ConfirmAction
                  label="Delete group"
                  confirmLabel="Delete permanently"
                  disabled={deleteGroup.isPending}
                  onConfirm={() => deleteGroup.mutate({ groupId })}
                />
              </AdminRow>
            </AdminList>
          </AdminSection>
        </>
      ) : null}
    </AdminLayout>
  );
};

AdminGroupPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminGroupPage;
