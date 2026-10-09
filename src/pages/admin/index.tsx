import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import { AdminLayout, AdminList, AdminRow, AdminSection } from '~/components/Admin/AdminLayout';
import { getServerAuthSession } from '~/server/auth';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const formatAmount = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

const SECTIONS = [
  {
    href: '/admin/users',
    label: 'Users',
    description: 'Search, delete, grant admin, resend emails',
  },
  { href: '/admin/groups', label: 'Groups', description: 'Members, owners, rename, delete' },
  { href: '/admin/expenses', label: 'Expenses', description: 'Search, view participants, delete' },
  {
    href: '/admin/settings',
    label: 'Settings',
    description: 'Registrations, invites, force settle',
  },
] as const;

const AdminDashboard: NextPageWithUser = () => {
  const statsQuery = api.admin.getStats.useQuery();
  const stats = statsQuery.data;

  return (
    <AdminLayout title="Admin">
      <AdminSection title="Overview">
        <AdminList>
          <AdminRow>
            <span>Users</span>
            <span>{stats?.userCount ?? '—'}</span>
          </AdminRow>
          <AdminRow>
            <span>Groups</span>
            <span>{stats?.groupCount ?? '—'}</span>
          </AdminRow>
          <AdminRow>
            <span>Expenses</span>
            <span>{stats?.expenseCount ?? '—'}</span>
          </AdminRow>
          <AdminRow>
            <span>Total volume (all currencies)</span>
            <span>{stats ? formatAmount(Number(stats.totalExpenseAmount) / 100) : '—'}</span>
          </AdminRow>
        </AdminList>
      </AdminSection>

      <AdminSection title="Manage">
        <AdminList>
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className="hover:bg-secondary/50 block">
              <AdminRow>
                <span>{section.label}</span>
                <span className="text-muted-foreground text-right text-sm">
                  {section.description}
                </span>
              </AdminRow>
            </Link>
          ))}
        </AdminList>
      </AdminSection>

      {stats ? (
        <>
          <AdminSection
            title="Recent users"
            action={
              <Link href="/admin/users" className="text-muted-foreground text-sm hover:underline">
                All users
              </Link>
            }
          >
            <AdminList>
              {stats.recentUsers.map((u) => (
                <AdminRow key={u.id}>
                  <span>{u.name ?? '—'}</span>
                  <span className="text-muted-foreground truncate text-sm">{u.email}</span>
                </AdminRow>
              ))}
            </AdminList>
          </AdminSection>

          <AdminSection
            title="Recent expenses"
            action={
              <Link
                href="/admin/expenses"
                className="text-muted-foreground text-sm hover:underline"
              >
                All expenses
              </Link>
            }
          >
            <AdminList>
              {stats.recentExpenses.map((e) => (
                <AdminRow key={e.id}>
                  <div className="min-w-0">
                    <div className="truncate">{e.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {e.paidByUser?.name ?? e.paidByUser?.email} ·{' '}
                      {new Date(e.expenseDate).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm">
                    {e.currency} {formatAmount(Number(e.amount) / 100)}
                  </span>
                </AdminRow>
              ))}
            </AdminList>
          </AdminSection>
        </>
      ) : null}
    </AdminLayout>
  );
};

AdminDashboard.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminDashboard;
