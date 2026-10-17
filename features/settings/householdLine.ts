import { t } from '@/i18n';

/** «Bob», «Bob y Eva», «Bob, Eva y Leo». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${t('settings.and')} ${names[names.length - 1]}`;
}

/**
 * The secondary line of the Ajustes door: the household and who else lives in it, or only the
 * household when you are alone.
 */
export function householdLine(household: string, others: readonly string[]): string {
  if (others.length === 0) return t('settings.householdLineAlone', { household });
  return t('settings.householdLine', { household, others: joinNames(others) });
}
