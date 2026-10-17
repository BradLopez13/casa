import { joinNames } from '@/domain/members/names';
import { t } from '@/i18n';

/**
 * The secondary line of the Ajustes door: the household and who else lives in it, or only the
 * household when you are alone.
 */
export function householdLine(household: string, others: readonly string[]): string {
  if (others.length === 0) return t('settings.householdLineAlone', { household });
  return t('settings.householdLine', { household, others: joinNames(others) });
}
