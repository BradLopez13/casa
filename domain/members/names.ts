import { t } from '@/i18n';

/** «Bob», «Bob y Eva», «Bob, Eva y Leo». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${t('settings.and')} ${names[names.length - 1]}`;
}
