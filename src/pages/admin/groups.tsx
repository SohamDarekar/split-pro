import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ArrowLeft, Receipt, Search, Trash2, Users } from 'lucide-react';
import MainLayout from '~/components/Layout/MainLayout';
import { api } from '~/utils/api';
import { type NextPageWithUser } from '~/types';
import { customServerSideTranslations } from '~/utils/i18n/server';
import type { GetServerSideProps } from 'next';
import { getServerAuthSession } from '~/server/auth';
import { Button } from '~/components/ui/button';
import { toast } from 'sonner';

const AdminGroupsPage: NextPageWithUser = () => {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const groupsQuery = api.admin.getGroups.useQuery({ search, page, pageSize: 20 });
  const deleteGroup = api.admin.deleteGroup.useMutation({
    onSuccess: () => {
      toast.success('Group deleted');
      void groupsQuery.refetch();
      setConfirmDelete(null);
    },
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
      <span className="text-2xl font-semibold">Groups</span>
    </div>
  );

  const data = groupsQuery.data;

  return (
    <>
      <Head>
        <title>Groups — Admin — SplitPro</title>
      </Head>
      <MainLayout header={header}>
        <div className="flex flex-col gap-4 pb-8">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              className="bg-secondary focus:ring-primary w-full rounded-lg py-2.5 pr-4 pl-9 text-sm outline-none focus:ring-1"
              placeholder="Search groups…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {groupsQuery.isLoading && (
            <div className="text-muted-foreground py-8 text-center">Loading…</div>
          )}

          <div className="flex flex-col gap-2">
            {data?.groups.map((group) => (
              <div
                key={group.id}
                className="bg-secondary flex items-start justify-between rounded-xl px-4 py-3"
              >
                <div>
                  <div className="font-medium">{group.name}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    Created by {group.createdBy?.name ?? group.createdBy?.email ?? 'Unknown'}
                  </div>
                  <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {group._count.groupUsers} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Receipt className="size-3" />
                      {group._count.expenses} expenses
                    </span>
                  </div>
                </div>
                <div>
                  {confirmDelete === group.id ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteGroup.mutate({ groupId: group.id })}
                        className="h-8 text-xs"
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(null)}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(group.id)}
                      className="hover:bg-background text-muted-foreground hover:text-destructive rounded-lg p-2"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
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

          {data?.groups.length === 0 && (
            <div className="text-muted-foreground py-8 text-center">No groups found</div>
          )}
        </div>
      </MainLayout>
    </>
  );
};

AdminGroupsPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminGroupsPage;
