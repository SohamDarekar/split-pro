import { SplitType } from '@prisma/client';
import { ChevronLeftIcon, PencilIcon, Undo2 } from 'lucide-react';
import { type GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { DeleteExpense } from '~/components/Expense/DeleteExpense';
import { ExpenseComments } from '~/components/Expense/ExpenseComments';
import ExpenseDetails, {
  EditCurrencyConversion,
  EditSettlement,
} from '~/components/Expense/ExpenseDetails';
import MainLayout from '~/components/Layout/MainLayout';
import { SimpleConfirmationDialog } from '~/components/SimpleConfirmationDialog';
import { Button } from '~/components/ui/button';
import { extractTemplateExpenseId } from '~/lib/cron';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const ExpensesPage: NextPageWithUser = ({ user }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const expenseId = router.query.expenseId as string;
  const keepAdding = !!router.query.keepAdding;

  const expenseQuery = api.expense.getExpenseDetails.useQuery({ expenseId });

  const recurrence = expenseQuery.data?.recurrence;
  const isTemplate = useMemo(
    () => (recurrence ? extractTemplateExpenseId(recurrence.job.command) === expenseId : false),
    [recurrence, expenseId],
  );

  const apiUtils = api.useUtils();
  const restoreMutation = api.expense.restoreExpense.useMutation();

  const handleRestore = useCallback(async () => {
    try {
      await restoreMutation.mutateAsync({ expenseId });
      await apiUtils.invalidate();
      toast.success(t('expense_details.restore_expense_details.restored'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('expense_details.restore_expense_details.failed'),
      );
    }
  }, [restoreMutation, expenseId, apiUtils, t]);

  const handleEditConfirm = useCallback(async () => {
    await router.push(`/add?expenseId=${expenseId}`);
  }, [router, expenseId]);

  const editDescription = useMemo(() => {
    if (!recurrence) {
      return '';
    }

    if (isTemplate) {
      return t('recurrence.template_edit_warning');
    }

    return (
      <>
        {t('recurrence.derived_edit_warning')}{' '}
        <Link href="/recurring" className="text-primary underline">
          {t('recurrence.view_recurring_page')}
        </Link>
      </>
    );
  }, [recurrence, isTemplate, t]);

  const renderEditButton = () => {
    const editButton = (
      <Button variant="ghost">
        <PencilIcon className="mr-1 h-4 w-4" />
      </Button>
    );

    // If expense has recurrence, show confirmation dialog
    if (recurrence) {
      return (
        <SimpleConfirmationDialog
          title={t('recurrence.edit_confirmation_title')}
          description={editDescription}
          hasPermission
          onConfirm={handleEditConfirm}
          loading={false}
        >
          {editButton}
        </SimpleConfirmationDialog>
      );
    }

    // No recurrence, just link directly
    return <Link href={`/add?expenseId=${expenseId}`}>{editButton}</Link>;
  };

  return (
    <>
      <Head>
        <title>{expenseQuery.data?.name ?? ''}</title>
      </Head>
      <MainLayout
        title={
          <div className="flex items-center gap-2">
            <Link href={keepAdding ? '/add' : '/activity'}>
              <ChevronLeftIcon className="mr-1 h-6 w-6" />
            </Link>
            <p className="text-[16px] font-normal">{t('ui.expense_details')}</p>
          </div>
        }
        actions={
          <div className="flex items-center gap-1">
            {!expenseQuery.data?.deletedBy ? (
              <div className="flex items-center gap-1">
                <DeleteExpense expenseId={expenseId} recurrence={recurrence} />
                {expenseQuery.data?.splitType === SplitType.CURRENCY_CONVERSION ? (
                  <EditCurrencyConversion expense={expenseQuery.data} />
                ) : expenseQuery.data?.splitType === SplitType.SETTLEMENT ? (
                  <EditSettlement expense={expenseQuery.data} />
                ) : (
                  renderEditButton()
                )}
              </div>
            ) : expenseQuery.data ? (
              <Button variant="ghost" onClick={handleRestore} disabled={restoreMutation.isPending}>
                <Undo2 className="mr-1 size-4" />
                {t('actions.restore')}
              </Button>
            ) : null}
          </div>
        }
      >
        {expenseQuery.data ? (
          <>
            <ExpenseDetails user={user} expense={expenseQuery.data} />
            <ExpenseComments
              expenseId={expenseId}
              userId={user.id}
              readOnly={!!expenseQuery.data.deletedBy}
            />
          </>
        ) : null}
      </MainLayout>
    </>
  );
};

ExpensesPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    ...(await customServerSideTranslations(context.locale, ['common'])),
  },
});

export default ExpensesPage;
