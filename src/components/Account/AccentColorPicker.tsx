import { Check, Palette } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  ACCENT_COLORS,
  ACCENT_COLOR_SWATCH_CLASS,
  type AccentColor,
  isAccentColor,
} from '~/lib/accentColor';
import { cn } from '~/lib/utils';
import { api } from '~/utils/api';

import { AppDrawer } from '../ui/drawer';
import { AccountButton } from './AccountButton';

export const AccentColorPicker: React.FC<{
  accentColor: AccentColor;
  onAccentColorChange: (accentColor: AccentColor) => void;
}> = ({ accentColor, onAccentColorChange }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const updateDetailsMutation = api.user.updateUserDetail.useMutation();

  const onSelect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const color = event.currentTarget.dataset.color;
      if (!color || !isAccentColor(color)) {
        return;
      }
      const previous = accentColor;

      document.documentElement.dataset.accent = color;
      onAccentColorChange(color);
      setOpen(false);

      updateDetailsMutation.mutate(
        { accentColor: color },
        {
          onError: (error) => {
            console.error('Error while saving accent color:', error);
            toast.error(t('errors.saving_expense'));
            document.documentElement.dataset.accent = previous;
            onAccentColorChange(previous);
          },
        },
      );
    },
    [accentColor, onAccentColorChange, updateDetailsMutation, t],
  );

  return (
    <AppDrawer
      trigger={
        <AccountButton>
          <Palette className="size-5 text-purple-500" />
          {t('account.accent_color.title')}
        </AccountButton>
      }
      open={open}
      onOpenChange={setOpen}
      leftAction={t('actions.back')}
      title={t('account.accent_color.title')}
      className="h-[50vh]"
    >
      <div className="mt-6 grid grid-cols-4 gap-4">
        {ACCENT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            data-color={color}
            className="flex flex-col items-center gap-2"
            onClick={onSelect}
          >
            <span
              className={cn(
                'ring-offset-background flex size-10 items-center justify-center rounded-full ring-2 ring-offset-2',
                ACCENT_COLOR_SWATCH_CLASS[color],
                accentColor === color ? 'ring-foreground' : 'ring-transparent',
              )}
            >
              {accentColor === color && <Check className="size-5 text-white" />}
            </span>
            <span className="text-xs text-gray-500">
              {t(`account.accent_color.colors.${color}`)}
            </span>
          </button>
        ))}
      </div>
    </AppDrawer>
  );
};
