import { ChevronLeftIcon } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';

import { BillRemindersContent } from '~/components/Account/BillReminders/BillReminders';
import MainLayout from '~/components/Layout/MainLayout';
import { Button } from '~/components/ui/button';
import { type NextPageWithUser } from '~/types';

// Header follows the exact pattern used by every other full-page sub-view in
// This app (src/pages/recurring.tsx, expenses/[expenseId].tsx,
// Balances/[friendId].tsx): a Link back to the known parent route wrapped
// Around a ChevronLeft, not router.back() — router.back() in this app is
// Reserved for "cancel out of an in-progress flow" (AddExpense, DeleteExpense),
// Which isn't what this is; Bill Reminders' parent is always /account.
const BillRemindersPage: NextPageWithUser = () => (
  <>
    <Head>
      <title>Bill Reminders</title>
    </Head>
    <MainLayout
      title={
        <div className="flex items-center gap-2">
          <Link href="/account">
            <Button variant="ghost" className="p-0">
              <ChevronLeftIcon className="mr-1 h-6 w-6" />
            </Button>
          </Link>
          <p className="text-[16px] font-normal">Bill Reminders</p>
        </div>
      }
    >
      <BillRemindersContent />
    </MainLayout>
  </>
);

BillRemindersPage.auth = true;

export default BillRemindersPage;
