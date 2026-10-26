import { joinNames } from '@/domain/members/names';
import { t } from '@/i18n';

/**
 * The secondary line of the Ajustes door: the household and who else lives in it, or only the
 * household when you are alone; with other households, how many more (bloque 12: «Casa, con
 * Segundo · y 1 casa más»).
 */
export function householdLine(household: string, others: readonly string[], more = 0): string {
  const line =
    others.length === 0
      ? t('settings.householdLineAlone', { household })
      : t('settings.householdLine', { household, others: joinNames(others) });
  if (more <= 0) return line;
  return more === 1
    ? t('households.moreOne', { line })
    : t('households.moreOther', { line, count: more });
}
