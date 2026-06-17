import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  LayoutGrid,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import MainLayout from '~/components/Layout/MainLayout';
import { api } from '~/utils/api';
import { type NextPageWithUser } from '~/types';
import { customServerSideTranslations } from '~/utils/i18n/server';
import type { GetServerSideProps } from 'next';
import { getServerAuthSession } from '~/server/auth';
const formatAmount = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  href?: string;
  color: string;
}> = ({ title, value, icon, href, color }) => {
  const inner = (
    <div
      className={`bg-secondary hover:bg-secondary/70 flex items-center gap-4 rounded-xl p-4 transition-colors ${href ? 'cursor-pointer' : ''}`}
    >
      <div className={`rounded-lg p-3 ${color}`}>{icon}</div>
      <div>
        <div className="text-muted-foreground text-sm">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
};

const AdminDashboard: NextPageWithUser = () => {
  const router = useRouter();
  const statsQuery = api.admin.getStats.useQuery();

  const stats = statsQuery.data;

  const header = (
    <div className="flex items-center gap-3">
      <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" />
      </button>
      <ShieldCheck className="text-primary size-6" />
      <span className="text-2xl font-semibold">Admin Panel</span>
    </div>
  );

  return (
    <>
      <Head>
        <title>Admin Panel — SplitPro</title>
      </Head>
      <MainLayout header={header}>
        <div className="flex flex-col gap-6 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Total Users"
              value={stats?.userCount ?? '—'}
              icon={<Users className="size-5 text-blue-400" />}
              color="bg-blue-500/10"
              href="/admin/users"
            />
            <StatCard
              title="Groups"
              value={stats?.groupCount ?? '—'}
              icon={<LayoutGrid className="size-5 text-teal-400" />}
              color="bg-teal-500/10"
              href="/admin/groups"
            />
            <StatCard
              title="Expenses"
              value={stats?.expenseCount ?? '—'}
              icon={<Receipt className="size-5 text-purple-400" />}
              color="bg-purple-500/10"
              href="/admin/expenses"
            />
            <StatCard
              title="Total Volume"
              value={stats ? formatAmount(Number(stats.totalExpenseAmount) / 100) : '—'}
              icon={<TrendingUp className="size-5 text-orange-400" />}
              color="bg-orange-500/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/admin/users">
              <div className="bg-secondary hover:bg-secondary/70 cursor-pointer rounded-xl p-4 transition-colors">
                <div className="mb-3 flex items-center gap-3">
                  <Users className="size-5 text-blue-400" />
                  <span className="font-semibold">User Management</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  View, search, delete users. Grant or revoke admin. Resend verification emails.
                </p>
              </div>
            </Link>
            <Link href="/admin/groups">
              <div className="bg-secondary hover:bg-secondary/70 cursor-pointer rounded-xl p-4 transition-colors">
                <div className="mb-3 flex items-center gap-3">
                  <LayoutGrid className="size-5 text-teal-400" />
                  <span className="font-semibold">Group Management</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Browse all groups, view members and expenses, delete groups.
                </p>
              </div>
            </Link>
            <Link href="/admin/expenses">
              <div className="bg-secondary hover:bg-secondary/70 cursor-pointer rounded-xl p-4 transition-colors">
                <div className="mb-3 flex items-center gap-3">
                  <Receipt className="size-5 text-purple-400" />
                  <span className="font-semibold">Expense Overview</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Browse all expenses, search, view participants, delete.
                </p>
              </div>
            </Link>
            <Link href="/admin/settings">
              <div className="bg-secondary hover:bg-secondary/70 cursor-pointer rounded-xl p-4 transition-colors">
                <div className="mb-3 flex items-center gap-3">
                  <Settings className="size-5 text-gray-400" />
                  <span className="font-semibold">Settings</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Toggle registrations, view invite queue, manage app settings.
                </p>
              </div>
            </Link>
          </div>

          {stats && (
            <>
              <div>
                <h2 className="mb-3 text-lg font-semibold">Recent Users</h2>
                <div className="flex flex-col gap-2">
                  {stats.recentUsers.map((u) => (
                    <div
                      key={u.id}
                      className="bg-secondary flex items-center justify-between rounded-lg px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-muted-foreground text-xs">{u.email}</div>
                      </div>
                      <Link
                        href={`/admin/users?highlight=${u.id}`}
                        className="text-primary text-sm"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-lg font-semibold">Recent Expenses</h2>
                <div className="flex flex-col gap-2">
                  {stats.recentExpenses.map((e) => (
                    <div
                      key={e.id}
                      className="bg-secondary flex items-center justify-between rounded-lg px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {e.paidByUser?.name} · {new Date(e.expenseDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {e.currency} {formatAmount(Number(e.amount) / 100)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </MainLayout>
    </>
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
