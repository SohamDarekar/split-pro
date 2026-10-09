import type { GetServerSideProps } from 'next';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AdminEmpty,
  AdminLayout,
  AdminList,
  AdminRow,
  AdminSection,
  AdminTextButton,
} from '~/components/Admin/AdminLayout';
import { Switch } from '~/components/ui/switch';
import { getServerAuthSession } from '~/server/auth';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const inputClassName =
  'border-border focus:border-foreground rounded-md border bg-transparent px-3 py-2 text-sm outline-none';

const AdminSettingsPage: NextPageWithUser = () => {
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

  const settings = settingsQuery.data;

  return (
    <AdminLayout title="Settings" backHref="/admin">
      <AdminSection title="Registration">
        <AdminList>
          <AdminRow>
            <div>
              <div>Disable new registrations</div>
              <div className="text-muted-foreground text-xs">
                Blocks new sign-ups. Existing users can still log in.
              </div>
            </div>
            <Switch
              checked={settings?.registrationsDisabled ?? false}
              disabled={settingsQuery.isLoading || setRegistrations.isPending}
              onCheckedChange={(disabled) => setRegistrations.mutate({ disabled })}
            />
          </AdminRow>
        </AdminList>
        {settings?.inviteOnly ? (
          <p className="text-muted-foreground text-xs">
            INVITE_ONLY is set, so new users are already blocked by the environment.
          </p>
        ) : null}
        {settings?.disableEmailSignup ? (
          <p className="text-muted-foreground text-xs">
            DISABLE_EMAIL_SIGNUP is set, so email sign-up is disabled by the environment.
          </p>
        ) : null}
      </AdminSection>

      <AdminSection title="Force settle balance">
        <p className="text-muted-foreground text-xs">
          Marks every unsettled share between two users in one currency as settled. User IDs are
          shown on the Users page.
        </p>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            forceSettle.mutate({
              userId: parseInt(forceSettleUserId),
              friendId: parseInt(forceSettleFriendId),
              currency: forceSettleCurrency,
            });
          }}
        >
          <input
            className={inputClassName}
            inputMode="numeric"
            placeholder="User ID"
            value={forceSettleUserId}
            onChange={(e) => setForceSettleUserId(e.target.value)}
          />
          <input
            className={inputClassName}
            inputMode="numeric"
            placeholder="Other user ID"
            value={forceSettleFriendId}
            onChange={(e) => setForceSettleFriendId(e.target.value)}
          />
          <input
            className={inputClassName}
            placeholder="Currency, e.g. AUD"
            value={forceSettleCurrency}
            onChange={(e) => setForceSettleCurrency(e.target.value.toUpperCase())}
          />
          <AdminTextButton
            type="submit"
            className="self-start"
            disabled={
              !forceSettleUserId ||
              !forceSettleFriendId ||
              !forceSettleCurrency ||
              forceSettle.isPending
            }
          >
            Settle balance
          </AdminTextButton>
        </form>
      </AdminSection>

      <AdminSection
        title="Pending invites"
        action={
          <AdminTextButton
            className="text-muted-foreground"
            onClick={() => void invitesQuery.refetch()}
          >
            Refresh
          </AdminTextButton>
        }
      >
        {invitesQuery.isLoading ? <AdminEmpty>Loading…</AdminEmpty> : null}
        {0 === invitesQuery.data?.invitedUsers.length ? (
          <AdminEmpty>No pending invites</AdminEmpty>
        ) : null}
        {invitesQuery.data?.invitedUsers.length ? (
          <AdminList>
            {invitesQuery.data.invitedUsers.map((u) => {
              const token = invitesQuery.data?.tokens.find((t) => t.identifier === u.email);
              return (
                <AdminRow key={u.id}>
                  <div className="min-w-0">
                    <div className="truncate">{u.email}</div>
                    {token ? (
                      <div className="text-muted-foreground text-xs">
                        Expires {new Date(token.expires).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>
                  <AdminTextButton
                    disabled={resendVerification.isPending}
                    onClick={() => u.email && resendVerification.mutate({ email: u.email })}
                  >
                    Resend
                  </AdminTextButton>
                </AdminRow>
              );
            })}
          </AdminList>
        ) : null}
      </AdminSection>
    </AdminLayout>
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
