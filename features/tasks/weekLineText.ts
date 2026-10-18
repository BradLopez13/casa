import type { WeekLine } from '@/domain/tasks/weekLine';
import { t } from '@/i18n';

/** The secondary line of the Tareas door. Spanish plural: 1 is singular, everything else plural. */
export function weekLineText(line: WeekLine): string {
  switch (line.kind) {
    case 'empty':
      return t('tasks.weekLine.empty');
    case 'mine':
      return t(line.count === 1 ? 'tasks.weekLine.mineOne' : 'tasks.weekLine.mineOther', {
        count: line.count,
      });
    case 'household':
      return t(
        line.household === 1 ? 'tasks.weekLine.householdOne' : 'tasks.weekLine.householdOther',
        { count: line.household },
      );
    case 'nothingMine':
      return t('tasks.weekLine.nothingMine');
    case 'person':
      if (line.count === 0) return t('tasks.weekLine.personNone', { name: line.name });
      return t(line.count === 1 ? 'tasks.weekLine.personOne' : 'tasks.weekLine.personOther', {
        name: line.name,
        count: line.count,
      });
  }
}
