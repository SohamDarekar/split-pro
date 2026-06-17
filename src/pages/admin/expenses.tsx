import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Search, Trash2 } from 'lucide-react';
import MainLayout from '~/components/Layout/MainLayout';
import { api } from '~/utils/api';
import { type NextPageWithUser } from '~/types';
import { customServerSideTranslations } from '~/utils/i18n/server';
import type { GetServerSideProps } from 'next';
import { getServerAuthSession } from '~/server/auth';
import { Button } from '~/components/ui/button';
import { toast } from 'sonner';

const AdminExpensesPage: NextPageWithUser = () => {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const expensesQuery = api.admin.getExpenses.useQuery({ search, page, pageSize: 20 });
  const deleteExpense = api.admin.deleteExpense.useMutation({
    onSuccess: () => {
      toast.success('Expense deleted');
      void expensesQuery.refetch();
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
      <span className="text-2xl font-semibold">Expenses</span>
    </div>
  );

  const data = expensesQuery.data;

  return (
    <>
      <Head>
        <title>Expenses — Admin — SplitPro</title>
      </Head>
      <MainLayout header={header}>
        <div className="flex flex-col gap-4 pb-8">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              className="bg-secondary focus:ring-primary w-full rounded-lg py-2.5 pr-4 pl-9 text-sm outline-none focus:ring-1"
              placeholder="Search expenses…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {expensesQuery.isLoading && (
            <div className="text-muted-foreground py-8 text-center">Loading…</div>
          )}

          <div className="flex flex-col gap-2">
            {data?.expenses.map((expense) => (
              <div key={expense.id} className="bg-secondary overflow-hidden rounded-xl">
                <div className="flex items-start justify-between px-4 py-3">
                  <div className="mr-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{expense.name}</span>
                      {expense.group && (
                        <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-xs">
                          {expense.group.name}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      Paid by {expense.paidByUser?.name} ·{' '}
                      {new Date(expense.expenseDate).toLocaleDateString()}
                    </div>
                    <div className="mt-0.5 text-sm font-medium">
                      {expense.currency}{' '}
                      {(Number(expense.amount) / 100).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setExpanded(expanded === expense.id ? null : expense.id)}
                      className="hover:bg-background text-muted-foreground rounded-lg p-2"
                    >
                      {expanded === expense.id ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    {confirmDelete === expense.id ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteExpense.mutate({ expenseId: expense.id })}
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
                        onClick={() => setConfirmDelete(expense.id)}
                        className="hover:bg-background text-muted-foreground hover:text-destructive rounded-lg p-2"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
                {expanded === expense.id && (
                  <div className="border-border border-t px-4 py-3">
                    <div className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                      Participants
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {expense.expenseParticipants.map((p) => (
                        <div key={p.userId} className="flex items-center justify-between text-sm">
                          <span>{p.user.name ?? p.user.email}</span>
                          <span
                            className={`font-medium ${p.settledAt ? 'text-teal-500' : 'text-muted-foreground'}`}
                          >
                            {expense.currency}{' '}
                            {(Number(p.amount) / 100).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                            {p.settledAt && ' ✓'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

          {data?.expenses.length === 0 && (
            <div className="text-muted-foreground py-8 text-center">No expenses found</div>
          )}
        </div>
      </MainLayout>
    </>
  );
};

AdminExpensesPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminExpensesPage;
