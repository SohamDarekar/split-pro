import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import {
  AdminEmpty,
  AdminLayout,
  AdminList,
  AdminPagination,
  AdminRow,
  AdminSearch,
} from '~/components/Admin/AdminLayout';
import { getServerAuthSession } from '~/server/auth';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const AdminGroupsPage: NextPageWithUser = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const groupsQuery = api.admin.getGroups.useQuery({ search, page, pageSize: 20 });
  const data = groupsQuery.data;

  return (
    <AdminLayout title="Groups" backHref="/admin">
      <AdminSearch
        value={search}
        placeholder="Search groups"
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      {groupsQuery.isLoading ? <AdminEmpty>Loading…</AdminEmpty> : null}
      {0 === data?.groups.length ? <AdminEmpty>No groups found</AdminEmpty> : null}

      {data?.groups.length ? (
        <AdminList>
          {data.groups.map((group) => (
            <Link
              key={group.id}
              href={`/admin/groups/${group.id}`}
              className="hover:bg-secondary/50 block"
            >
              <AdminRow>
                <div className="min-w-0">
                  <div className="truncate">
                    {group.name}
                    {group.archivedAt ? (
                      <span className="text-muted-foreground"> · archived</span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Owner: {group.createdBy?.name ?? group.createdBy?.email ?? 'Unknown'}
                  </div>
                </div>
                <div className="text-muted-foreground shrink-0 text-right text-xs">
                  <div>{group._count.groupUsers} members</div>
                  <div>{group._count.expenses} expenses</div>
                </div>
              </AdminRow>
            </Link>
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

AdminGroupsPage.auth = true;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context as any);
  if (!session?.user?.isAdmin) {
    return { redirect: { destination: '/account', permanent: false } };
  }
  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};

export default AdminGroupsPage;
