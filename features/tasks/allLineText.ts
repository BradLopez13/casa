import type { WeekLine } from '@/domain/tasks/weekLine';
import { t } from '@/i18n';

/** The secondary line of the Tareas door: everything pending, dated or not. Spanish plural: 1 is singular, the rest plural. */
export function allLineText(line: WeekLine): string {
  switch (line.kind) {
    case 'empty':
      return t('tasks.allLine.empty');
    case 'mine':
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
