import { SearchIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import React, { useCallback } from 'react';

import { Input } from '../ui/input';

interface ActivitySearchProps {
  value: string;
  onChange: (value: string) => void;
}

export const ActivitySearch: React.FC<ActivitySearchProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );
  const onClear = useCallback(() => onChange(''), [onChange]);

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
      <Input
        value={value}
        onChange={onInputChange}
        placeholder={t('activity_search.placeholder')}
        className="pl-9"
        rightIcon={
          '' !== value ? (
            <button type="button" onClick={onClear} aria-label={t('actions.clear')}>
              <XIcon className="size-4 text-gray-400" />
            </button>
          ) : null
        }
      />
    </div>
  );
};
