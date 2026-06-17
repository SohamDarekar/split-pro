import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ArrowLeft, Mail, RefreshCw, UserMinus } from 'lucide-react';
import MainLayout from '~/components/Layout/MainLayout';
import { api } from '~/utils/api';
import { type NextPageWithUser } from '~/types';
import { customServerSideTranslations } from '~/utils/i18n/server';
import type { GetServerSideProps } from 'next';
import { getServerAuthSession } from '~/server/auth';
import { Button } from '~/components/ui/button';
import { toast } from 'sonner';

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, checked, disabled, onChange }) => (
  <div className="bg-secondary flex items-center justify-between gap-4 rounded-xl px-4 py-3">
    <div>
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground mt-0.5 text-xs">{description}</div>
    </div>
    <button
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`bg-background pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

const AdminSettingsPage: NextPageWithUser = () => {
  const router = useRouter();
  const [forceSettleUserId, setForceSettleUserId] = useState('');
  const [forceSettleFriendId, setForceSettleFriendId] = useState('');
  const [forceSettleCurrency, setForceSettleCurrency] = useState('');

  const settingsQuery = api.admin.getSettings.useQuery();
  const invitesQuery = api.admin.getPendingInvites.useQuery();

  const setRegistrations = api.admin.setRegistrationsDisabled.useMutation({
    onSuccess: () => {
      toast.success('Setting updated');
      void settingsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const resendVerification = api.admin.resendVerification.useMutation({
    onSuccess: () => toast.success('Verification email sent'),
    onError: (e) => toast.error(e.message),
  });

  const forceSettle = api.admin.forceSettleBalance.useMutation({
    onSuccess: () => {
      toast.success('Balance settled');
      setForceSettleUserId('');
      setForceSettleFriendId('');
      setForceSettleCurrency('');
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
      <span className="text-2xl font-semibold">Settings</span>
    </div>
  );

  const settings = settingsQuery.data;

  return (
    <>
      <Head>
        <title>Settings — Admin — SplitPro</title>
      </Head>
      <MainLayout header={header}>
        <div className="flex flex-col gap-6 pb-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Registration
            </h2>
            <ToggleRow
              label="Disable New Registrations"
              description="Block all new sign-ups. Existing users can still log in."
              checked={settings?.registrationsDisabled ?? false}
              disabled={settingsQuery.isLoading || setRegistrations.isPending}
              onChange={(v) => setRegistrations.mutate({ disabled: v })}
            />
            {settings?.inviteOnly && (
              <div className="rounded-xl bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
                INVITE_ONLY env var is set — new users are already blocked at the env level.
              </div>
            )}
            {settings?.disableEmailSignup && (
              <div className="rounded-xl bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
                DISABLE_EMAIL_SIGNUP env var is set — email sign-up is disabled at the env level.
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Force Settle Balance
            </h2>
            <div className="bg-secondary flex flex-col gap-3 rounded-xl px-4 py-4">
              <p className="text-muted-foreground text-sm">
                Manually zero out balance between two users for a given currency.
              </p>
              <input
                className="bg-background focus:ring-primary rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
                placeholder="User ID"
                value={forceSettleUserId}
                onChange={(e) => setForceSettleUserId(e.target.value)}
              />
              <input
                className="bg-background focus:ring-primary rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
                placeholder="Friend's User ID"
                value={forceSettleFriendId}
                onChange={(e) => setForceSettleFriendId(e.target.value)}
              />
              <input
                className="bg-background focus:ring-primary rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
                placeholder="Currency (e.g. AUD)"
                value={forceSettleCurrency}
                onChange={(e) => setForceSettleCurrency(e.target.value.toUpperCase())}
              />
              <Button
                size="sm"
                disabled={
                  !forceSettleUserId ||
                  !forceSettleFriendId ||
                  !forceSettleCurrency ||
                  forceSettle.isPending
                }
                onClick={() =>
                  forceSettle.mutate({
                    userId: parseInt(forceSettleUserId),
                    friendId: parseInt(forceSettleFriendId),
                    currency: forceSettleCurrency,
                  })
                }
                className="self-start"
              >
                <UserMinus className="mr-1.5 size-4" />
                Settle Balance
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Pending Invites
              </h2>
              <button
                onClick={() => invitesQuery.refetch()}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
            {invitesQuery.isLoading && (
              <div className="text-muted-foreground text-sm">Loading…</div>
            )}
            {invitesQuery.data?.invitedUsers.length === 0 && (
              <div className="text-muted-foreground bg-secondary rounded-xl px-4 py-3 text-sm">
                No pending invites
              </div>
            )}
            <div className="flex flex-col gap-2">
              {invitesQuery.data?.invitedUsers.map((u) => {
                const token = invitesQuery.data?.tokens.find((t) => t.identifier === u.email);
                return (
                  <div
                    key={u.id}
                    className="bg-secondary flex items-center justify-between rounded-xl px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                      {token && (
                        <div className="text-muted-foreground text-xs">
                          Expires {new Date(token.expires).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => u.email && resendVerification.mutate({ email: u.email })}
                      disabled={resendVerification.isPending}
                      className="hover:bg-background text-primary rounded-lg p-2"
                      title="Resend verification email"
                    >
                      <Mail className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </MainLayout>
    </>
  );
};

AdminSettingsPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminSettingsPage;
