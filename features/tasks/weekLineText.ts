import type { WeekLine } from '@/domain/tasks/weekLine';
import { t, type MessageKey } from '@/i18n';

type Scope = 'weekLine' | 'allLine';

/** The secondary line of the Tareas door in Semana. Spanish plural: 1 is singular, the rest plural. */
export function weekLineText(line: WeekLine): string {
  return lineText(line, 'weekLine');
}

/** The secondary line of the Tareas door in Todas: everything pending, not only this week. */
export function allLineText(line: WeekLine): string {
  return lineText(line, 'allLine');
}

function lineText(line: WeekLine, scope: Scope): string {
  const key = (name: string) => `tasks.${scope}.${name}` as MessageKey;
  switch (line.kind) {
    case 'empty':
      return t(key('empty'));
    case 'mine':
      return t(line.count === 1 ? key('mineOne') : key('mineOther'), {
        count: line.count,
      });
    case 'household':
      return t(line.household === 1 ? key('householdOne') : key('householdOther'), {
        count: line.household,
      });
    case 'nothingMine':
      return t(key('nothingMine'));
    case 'person':
      if (line.count === 0) return t(key('personNone'), { name: line.name });
      return t(line.count === 1 ? key('personOne') : key('personOther'), {
        name: line.name,
        count: line.count,
      });
  }
}
