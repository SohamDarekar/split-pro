import { CheckIcon, ChevronDown, CopyIcon, Link2Icon, QrCodeIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'next-i18next';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

interface InviteQrCodeProps {
  publicId: string;
  groupName: string;
}

const LOGO_SIZE = 44;
const COPIED_RESET_MS = 2000;

// Navigator.clipboard is undefined outside secure contexts (e.g. http over a LAN address)
const copyToClipboard = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  // Mount inside the focused element's parent so the drawer's focus trap doesn't steal focus
  const container = document.activeElement?.parentElement ?? document.body;
  container.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand('copy')) {
      throw new Error('Copy command was rejected');
    }
  } finally {
    container.removeChild(textarea);
  }
};

const InviteQrCode: React.FC<InviteQrCodeProps> = ({ publicId, groupName }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const onToggle = useCallback(() => setVisible((value) => !value), []);

  // Only evaluated once the card is open, which is always on the client
  const getInviteLink = useCallback(
    () => `${window.location.origin}/join-group?groupId=${publicId}`,
    [publicId],
  );

  const onCopy = useCallback(async () => {
    try {
      await copyToClipboard(getInviteLink());
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (error) {
      console.error(error);
      toast.error(t('group_details.qr.copy_failed'));
    }
  }, [getInviteLink, t]);

  const inviteLink = visible ? getInviteLink() : '';

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={visible}
        className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
      >
        <span className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
            <QrCodeIcon className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-medium">{t('group_details.qr.title')}</span>
            <span className="text-xs text-gray-500">{t('group_details.qr.subtitle')}</span>
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 text-gray-400 transition-transform', visible && 'rotate-180')}
        />
      </button>

      {visible ? (
        <div className="flex flex-col items-center gap-4 border-t px-4 py-6">
          {/* Always dark-on-white with a quiet zone so scanners work in dark mode */}
          <div className="rounded-2xl bg-white p-4 shadow-lg">
            <QRCodeSVG
              value={inviteLink}
              size={200}
              level="H"
              marginSize={0}
              title={groupName}
              imageSettings={{
                src: '/logo_circle.png',
                height: LOGO_SIZE,
                width: LOGO_SIZE,
                excavate: true,
              }}
            />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-lg font-semibold">{groupName}</p>
            <p className="max-w-[240px] text-sm text-gray-400">
              {t('group_details.qr.scan_to_join')}
            </p>
          </div>

          <div className="flex w-full items-center gap-3 text-xs text-gray-500">
            <span className="bg-border h-px flex-1" />
            {t('group_details.qr.or_share_link')}
            <span className="bg-border h-px flex-1" />
          </div>

          <div className="bg-muted/40 flex w-full items-center gap-2 rounded-xl border p-1.5 pl-3">
            <Link2Icon className="size-4 shrink-0 text-gray-500" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-400">
              {inviteLink.replace(/^https?:\/\//, '')}
            </span>
            <Button size="sm" variant={copied ? 'secondary' : 'default'} onClick={onCopy}>
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              {copied ? t('group_details.copied') : t('group_details.qr.copy_link')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InviteQrCode;
