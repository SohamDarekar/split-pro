import Head from 'next/head';
import Link from 'next/link';
import React from 'react';

import MainLayout from '~/components/Layout/MainLayout';
import { cn } from '~/lib/utils';

export const AdminLayout: React.FC<{
  title: string;
  backHref?: string;
  children: React.ReactNode;
}> = ({ title, backHref, children }) => (
  <>
    <Head>
      <title>{`${title} · Admin`}</title>
    </Head>
    <MainLayout
      header={
        <div className="flex items-baseline gap-4">
          {backHref ? (
            <Link href={backHref} className="text-muted-foreground hover:text-foreground text-sm">
              Back
            </Link>
          ) : null}
          <span className="text-xl font-semibold">{title}</span>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-8">{children}</div>
    </MainLayout>
  </>
);

export const AdminSection: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <section className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

/** Bordered list; children should be AdminRow elements. */
export const AdminList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="divide-border border-border divide-y rounded-md border">{children}</div>
);

export const AdminRow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('flex items-center justify-between gap-4 px-3 py-2.5', className)}>
    {children}
  </div>
);

export const AdminTextButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' }
> = ({ tone = 'default', className, ...props }) => (
  <button
    type="button"
    className={cn(
      'text-sm underline-offset-4 hover:underline disabled:opacity-50 disabled:hover:no-underline',
      'danger' === tone ? 'text-red-500' : 'text-foreground',
      className,
    )}
    {...props}
  />
);

/** Two-step inline confirm for destructive actions. */
export const ConfirmAction: React.FC<{
  label: string;
  confirmLabel?: string;
  disabled?: boolean;
  onConfirm: () => void;
}> = ({ label, confirmLabel = 'Confirm', disabled, onConfirm }) => {
  const [confirming, setConfirming] = React.useState(false);

  if (!confirming) {
    return (
      <AdminTextButton tone="danger" disabled={disabled} onClick={() => setConfirming(true)}>
        {label}
      </AdminTextButton>
    );
  }

  return (
    <span className="flex gap-3">
      <AdminTextButton
        tone="danger"
        disabled={disabled}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </AdminTextButton>
      <AdminTextButton onClick={() => setConfirming(false)}>Cancel</AdminTextButton>
    </span>
  );
};

export const AdminSearch: React.FC<{
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ value, placeholder, onChange }) => (
  <input
    className="border-border focus:border-foreground w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
);

export const AdminPagination: React.FC<{
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}> = ({ page, pageSize, total, onPageChange }) => {
  if (total <= pageSize) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex items-center justify-between text-sm">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <span className="flex gap-4">
        <AdminTextButton disabled={1 === page} onClick={() => onPageChange(page - 1)}>
          Previous
        </AdminTextButton>
        <AdminTextButton disabled={page * pageSize >= total} onClick={() => onPageChange(page + 1)}>
          Next
        </AdminTextButton>
      </span>
    </div>
  );
};

export const AdminEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>
);
