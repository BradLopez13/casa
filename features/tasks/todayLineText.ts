import type { TodayLine } from '@/domain/tasks/todayLine';
import { t } from '@/i18n';

export type TodayLineText = {
  first: string;
  /** The count inside `first`, drawn a little larger; null when the line has none. */
  number: string | null;
  second: string | null;
};

const plain = (first: string): TodayLineText => ({ first, number: null, second: null });

/** The sentences of the second line, one after the other; null when there is none. */
const join = (...parts: (string | null)[]): string | null => {
  const said = parts.filter((part): part is string => part !== null);
  return said.length === 0 ? null : said.join(' ');
};

/** The words of the door of Hoy. Spanish plural: 1 is singular, everything else plural. */
export function todayLineText(line: TodayLine): TodayLineText {
  switch (line.kind) {
    case 'empty':
      return plain(t('today.line.empty'));
    case 'allDone':
      return plain(t('today.line.allDone'));
    case 'mine': {
      // The second line: what waits from other days, then what is left for the household (always
      // said, so the door never leaves the line out). With the filter on «Tú» there is no home line.
      const household =
        line.household === null
          ? null
          : line.household === 0
            ? t('today.line.householdNone')
            : t(line.household === 1 ? 'today.line.householdOne' : 'today.line.householdOther', {
                count: line.household,
              });
      if (line.today === 0) {
        const overdue = t(
          line.overdue === 1 ? 'today.line.onlyOverdueOne' : 'today.line.onlyOverdueOther',
          { count: line.overdue },
        );
        return { first: t('today.line.noneToday'), number: null, second: join(overdue, household) };
      }
      const overdue =
        line.overdue === 0
          ? null
          : t(line.overdue === 1 ? 'today.line.overdueOne' : 'today.line.overdueOther', {
              count: line.overdue,
            });
      return {
        first: t(line.today === 1 ? 'today.line.mineOne' : 'today.line.mineOther', {
          count: line.today,
        }),
        number: String(line.today),
        second: join(overdue, household),
      };
    }
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
