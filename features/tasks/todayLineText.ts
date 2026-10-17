import type { TodayLine } from '@/domain/tasks/todayLine';
import { t } from '@/i18n';

export type TodayLineText = {
  first: string;
  /** The count inside `first`, drawn a little larger; null when the line has none. */
  number: string | null;
  second: string | null;
};

const plain = (first: string): TodayLineText => ({ first, number: null, second: null });

/** The words of the door of Hoy. Spanish plural: 1 is singular, everything else plural. */
export function todayLineText(line: TodayLine): TodayLineText {
  switch (line.kind) {
    case 'empty':
      return plain(t('today.line.empty'));
    case 'allDone':
      return plain(t('today.line.allDone'));
    case 'mine':
      return {
        first: t(line.count === 1 ? 'today.line.mineOne' : 'today.line.mineOther', {
          count: line.count,
        }),
        number: String(line.count),
        second:
          line.household === null || line.household === 0
            ? null
            : t(line.household === 1 ? 'today.line.householdOne' : 'today.line.householdOther', {
                count: line.household,
              }),
      };
    case 'household':
      return {
        first: t(line.household === 1 ? 'today.line.householdOne' : 'today.line.householdOther', {
          count: line.household,
        }),
        number: String(line.household),
        second: null,
      };
    case 'nothingMine':
      if (line.unassigned === 0) return plain(t('today.line.nothingMine'));
      return {
        first: t(
          line.unassigned === 1
            ? 'today.line.nothingMineUnassignedOne'
            : 'today.line.nothingMineUnassignedOther',
          { count: line.unassigned },
        ),
        number: String(line.unassigned),
        second: null,
      };
    case 'person':
      if (line.count === 0) return plain(t('today.line.personNone', { name: line.name }));
      return {
        first: t(line.count === 1 ? 'today.line.personOne' : 'today.line.personOther', {
          name: line.name,
          count: line.count,
        }),
        number: String(line.count),
        second: null,
      };
  }
}
