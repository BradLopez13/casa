import { t } from '@/i18n';

/** What a screen reader says for a section heading: its title and how many tasks it holds. */
export function sectionA11yLabel(title: string, count: number): string {
  return count === 1
    ? t('tasks.sectionA11yOne', { title })
    : t('tasks.sectionA11yOther', { title, count });
}
