import { CATEGORIES, type CategoryItem } from '~/lib/category';
import { useMemo } from 'react';
import { useTranslation } from 'next-i18next';
import { ChevronDown } from 'lucide-react';

import { Button } from '../ui/button';
import { CategoryIcon } from '../ui/categoryIcons';
import { AppDrawer, AppDrawerClose } from '../ui/drawer';

export const CategoryPicker: React.FC<{
  category: string;
  onCategoryPick: (category: string) => void;
}> = ({ category, onCategoryPick }) => {
  const { t } = useTranslation('categories');

  const categoryLabel = useMemo(() => {
    for (const [sectionName, items] of Object.entries(CATEGORIES)) {
      for (const key of items) {
        const value = key === 'other' ? sectionName : key;
        if (value === category) {
          return t(`categories_list.${sectionName}.items.${key}`, { ns: 'categories' });
        }
      }
    }
    return category;
  }, [category, t]);

  const trigger = useMemo(
    () => (
      <div className="flex h-10 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm">
        <CategoryIcon category={category} size={16} className="shrink-0" />
        <span className="max-w-[90px] truncate">{categoryLabel}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </div>
    ),
    [category, categoryLabel],
  );

  return (
    <AppDrawer trigger={trigger} title={t('title')} className="h-[70vh]" shouldCloseOnAction>
      {Object.entries(CATEGORIES).map(([categoryName, categoryItems]) => (
        <div key={categoryName} className="mb-8">
          <h3 className="mb-4 text-lg font-semibold">
            {t(`categories_list.${categoryName}.name`)}
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(75px,1fr))] gap-4">
            {categoryItems.map((key: string) => {
              const value = key === 'other' ? categoryName : key;
              return (
                <AppDrawerClose key={key} asChild>
                  <Button
                    variant="ghost"
                    className="flex h-[75px] w-[75px] flex-col items-center justify-start gap-1 justify-self-center py-3 text-center"
                    onClick={() => onCategoryPick(value)}
                  >
                    <span className="block flex-shrink-0 text-2xl">
                      <CategoryIcon category={value as CategoryItem} />
                    </span>
                    <span className="block text-xs text-wrap">
                      {t(`categories_list.${categoryName}.items.${key}`, { ns: 'categories' })}
                    </span>
                  </Button>
                </AppDrawerClose>
              );
            })}
          </div>
        </div>
      ))}
    </AppDrawer>
  );
};
