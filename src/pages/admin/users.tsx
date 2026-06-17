import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ArrowLeft, Mail, Search, Shield, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react';
import MainLayout from '~/components/Layout/MainLayout';
import { api } from '~/utils/api';
import { type NextPageWithUser } from '~/types';
import { customServerSideTranslations } from '~/utils/i18n/server';
import type { GetServerSideProps } from 'next';
import { getServerAuthSession } from '~/server/auth';
import { Button } from '~/components/ui/button';
import { toast } from 'sonner';

const AdminUsersPage: NextPageWithUser = () => {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const usersQuery = api.admin.getUsers.useQuery({ search, page, pageSize: 20 });
  const deleteUser = api.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success('User deleted');
      void usersQuery.refetch();
      setConfirmDelete(null);
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

  const header = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push('/admin')}
        className="text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-5" />
      </button>
      <span className="text-2xl font-semibold">Users</span>
    </div>
  );

  const data = usersQuery.data;

  return (
    <>
      <Head>
        <title>Users — Admin — SplitPro</title>
      </Head>
      <MainLayout header={header}>
        <div className="flex flex-col gap-4 pb-8">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              className="bg-secondary focus:ring-primary w-full rounded-lg py-2.5 pr-4 pl-9 text-sm outline-none focus:ring-1"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {usersQuery.isLoading && (
            <div className="text-muted-foreground py-8 text-center">Loading…</div>
          )}

          <div className="flex flex-col gap-2">
            {data?.users.map((user) => (
              <div key={user.id} className="bg-secondary flex flex-col gap-2 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      {user.isAdmin && (
                        <span className="bg-primary/20 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
                          Admin
                        </span>
                      )}
                      {!user.emailVerified && (
                        <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-400">
                          Unverified
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">{user.email}</div>
                    <div className="text-muted-foreground text-xs">
                      {user._count.addedExpenses} expenses · {user._count.associatedGroups} groups ·{' '}
                      {user.currency}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!user.emailVerified && (
                      <button
                        onClick={() =>
                          user.email && resendVerification.mutate({ email: user.email })
                        }
                        title="Resend verification"
                        className="hover:bg-background rounded-lg p-2 text-orange-400"
                      >
                        <Mail className="size-4" />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        toggleAdmin.mutate({ userId: user.id, isAdmin: !user.isAdmin })
                      }
                      title={user.isAdmin ? 'Revoke admin' : 'Grant admin'}
                      className={`hover:bg-background rounded-lg p-2 ${user.isAdmin ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {user.isAdmin ? (
                        <Shield className="size-4" />
                      ) : (
                        <ShieldOff className="size-4" />
                      )}
                    </button>
                    {confirmDelete === user.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteUser.mutate({ userId: user.id })}
                          className="bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-lg p-2"
                        >
                          <UserX className="size-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="hover:bg-background text-muted-foreground rounded-lg p-2"
                        >
                          <UserCheck className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(user.id)}
                        title="Delete user"
                        className="hover:bg-background text-muted-foreground hover:text-destructive rounded-lg p-2"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data && data.total > data.pageSize && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of{' '}
                {data.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * data.pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {data?.users.length === 0 && (
            <div className="text-muted-foreground py-8 text-center">No users found</div>
          )}
        </div>
      </MainLayout>
    </>
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
