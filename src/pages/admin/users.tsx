import type { GetServerSideProps } from 'next';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AdminEmpty,
  AdminLayout,
  AdminList,
  AdminPagination,
  AdminRow,
  AdminSearch,
  AdminTextButton,
  ConfirmAction,
} from '~/components/Admin/AdminLayout';
import { getServerAuthSession } from '~/server/auth';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const AdminUsersPage: NextPageWithUser = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const usersQuery = api.admin.getUsers.useQuery({ search, page, pageSize: 20 });
  const deleteUser = api.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success('User deleted');
      void usersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleAdmin = api.admin.toggleAdmin.useMutation({
    onSuccess: () => {
      toast.success('Admin status updated');
      void usersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const resendVerification = api.admin.resendVerification.useMutation({
    onSuccess: () => toast.success('Verification email sent'),
    onError: (e) => toast.error(e.message),
  });

  const data = usersQuery.data;

  return (
    <AdminLayout title="Users" backHref="/admin">
      <AdminSearch
        value={search}
        placeholder="Search by name or email"
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      {usersQuery.isLoading ? <AdminEmpty>Loading…</AdminEmpty> : null}
      {0 === data?.users.length ? <AdminEmpty>No users found</AdminEmpty> : null}

      {data?.users.length ? (
        <AdminList>
          {data.users.map((user) => (
            <AdminRow key={user.id} className="flex-wrap items-start">
              <div className="min-w-0">
                <div>
                  {user.name ?? '—'}
                  {user.isAdmin ? <span className="text-muted-foreground"> · admin</span> : null}
                  {!user.emailVerified ? (
                    <span className="text-muted-foreground"> · unverified</span>
                  ) : null}
                </div>
                <div className="text-muted-foreground truncate text-xs">{user.email}</div>
                <div className="text-muted-foreground text-xs">
                  #{user.id} · {user._count.addedExpenses} expenses · {user._count.associatedGroups}{' '}
                  groups · {user.currency}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {!user.emailVerified && user.email ? (
                  <AdminTextButton
                    disabled={resendVerification.isPending}
                    onClick={() => user.email && resendVerification.mutate({ email: user.email })}
                  >
                    Resend email
                  </AdminTextButton>
                ) : null}
                <AdminTextButton
                  disabled={toggleAdmin.isPending}
                  onClick={() => toggleAdmin.mutate({ userId: user.id, isAdmin: !user.isAdmin })}
                >
                  {user.isAdmin ? 'Remove admin' : 'Make admin'}
                </AdminTextButton>
                <ConfirmAction
                  label="Delete"
                  confirmLabel="Delete user"
                  disabled={deleteUser.isPending}
                  onConfirm={() => deleteUser.mutate({ userId: user.id })}
                />
              </div>
            </AdminRow>
          ))}
        </AdminList>
      ) : null}

      {data ? (
        <AdminPagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
        />
      ) : null}
    </AdminLayout>
  );
};

AdminUsersPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminUsersPage;
