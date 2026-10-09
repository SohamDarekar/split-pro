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

const formatAmount = (amount: bigint) =>
  (Number(amount) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

const AdminExpensesPage: NextPageWithUser = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const expensesQuery = api.admin.getExpenses.useQuery({ search, page, pageSize: 20 });
  const deleteExpense = api.admin.deleteExpense.useMutation({
    onSuccess: () => {
      toast.success('Expense deleted');
      void expensesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const data = expensesQuery.data;

  return (
    <AdminLayout title="Expenses" backHref="/admin">
      <AdminSearch
        value={search}
        placeholder="Search expenses"
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      {expensesQuery.isLoading ? <AdminEmpty>Loading…</AdminEmpty> : null}
      {0 === data?.expenses.length ? <AdminEmpty>No expenses found</AdminEmpty> : null}

      {data?.expenses.length ? (
        <AdminList>
          {data.expenses.map((expense) => (
            <div key={expense.id}>
              <AdminRow className="flex-wrap items-start">
                <div className="min-w-0">
                  <div className="truncate">{expense.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {expense.currency} {formatAmount(expense.amount)} · paid by{' '}
                    {expense.paidByUser?.name ?? expense.paidByUser?.email} ·{' '}
                    {new Date(expense.expenseDate).toLocaleDateString()}
                    {expense.group ? ` · ${expense.group.name}` : ''}
                  </div>
                </div>
                <div className="flex gap-4">
                  <AdminTextButton
                    onClick={() => setExpanded(expanded === expense.id ? null : expense.id)}
                  >
                    {expanded === expense.id ? 'Hide' : 'Participants'}
                  </AdminTextButton>
                  <ConfirmAction
                    label="Delete"
                    confirmLabel="Delete expense"
                    disabled={deleteExpense.isPending}
                    onConfirm={() => deleteExpense.mutate({ expenseId: expense.id })}
                  />
                </div>
              </AdminRow>
              {expanded === expense.id ? (
                <div className="flex flex-col gap-1 px-3 pb-3 text-sm">
                  {expense.expenseParticipants.map((p) => (
                    <div key={p.userId} className="flex justify-between gap-4">
                      <span>{p.user.name ?? p.user.email}</span>
                      <span className="text-muted-foreground">
                        {expense.currency} {formatAmount(p.amount)}
                        {p.settledAt ? ' · settled' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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

AdminExpensesPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminExpensesPage;
