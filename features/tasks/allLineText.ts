import type { WeekLine } from '@/domain/tasks/weekLine';
import { t } from '@/i18n';

/**
 * The secondary line of the Tareas door: what the tab is for («Todo lo del hogar, por día.»,
 * fase 10c; «Todo lo de esta casa» with several households, bloque 12), then how much is pending,
 * dated or not. Spanish plural: 1 is singular, the rest plural.
 */
export function allLineText(
  line: WeekLine,
  several = false,
  day?: string,
  /** A day with its name («sábado 11»): «Lo del sábado 11», not «Lo de sábado 11». */
  named = false,
): string {
  // With a day pill chosen, the line says what it filters (bloque 14.5, P3): «Lo de hoy en la casa.»
  const purpose =
    day === undefined
      ? t(several ? 'tasks.allLine.purposeThis' : 'tasks.allLine.purpose')
      : t(
          named
            ? several
              ? 'tasks.allLine.purposeDayNamedThis'
              : 'tasks.allLine.purposeDayNamed'
            : several
              ? 'tasks.allLine.purposeDayThis'
              : 'tasks.allLine.purposeDay',
          { day },
        );
  return `${purpose} ${count(line, day !== undefined)}`;
}

function count(line: WeekLine, oneDay: boolean): string {
  switch (line.kind) {
    case 'empty':
      return t('tasks.allLine.empty');
    case 'mine':
      if (oneDay) {
        return t(line.count === 1 ? 'today.line.mineOne' : 'today.line.mineOther', {
          count: line.count,
        });
      }
      return t(line.count === 1 ? 'tasks.allLine.mineOne' : 'tasks.allLine.mineOther', {
        count: line.count,
      });
    case 'household':
      return t(
        line.household === 1 ? 'tasks.allLine.householdOne' : 'tasks.allLine.householdOther',
        { count: line.household },
      );
    case 'nothingMine':
      return t('tasks.allLine.nothingMine');
    case 'person':
      if (line.count === 0) return t('tasks.allLine.personNone', { name: line.name });
      return t(line.count === 1 ? 'tasks.allLine.personOne' : 'tasks.allLine.personOther', {
        name: line.name,
        count: line.count,
      });
  }
}
