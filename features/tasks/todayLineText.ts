import type { TodayLine } from '@/domain/tasks/todayLine';
import { t } from '@/i18n';

export type TodayLineText = {
  first: string;
  /** The count inside `first`, drawn a little larger; null when the line has none. */
  number: string | null;
  second: string | null;
};

const plain = (first: string): TodayLineText => ({ first, number: null, second: null });

/**
 * The words of the door of Hoy. Spanish plural: 1 is singular, everything else plural. With
 * several households (bloque 12) the household is «esta casa», not «el hogar».
 */
export function todayLineText(line: TodayLine, several = false): TodayLineText {
  /** What is left for the household as a sentence of its own. */
  const householdSentence = (household: number): string =>
    household === 0
      ? t(several ? 'today.line.thisHouseholdNone' : 'today.line.householdNone')
      : several
        ? t(household === 1 ? 'today.line.thisHouseholdOne' : 'today.line.thisHouseholdOther', {
            count: household,
          })
        : t(household === 1 ? 'today.line.householdOne' : 'today.line.householdOther', {
            count: household,
          });

  /** «3 de días anteriores; al hogar no le queda nada más.»: the two facts in one sentence. */
  const joined = (overdue: string, household: number): string =>
    t('today.line.joined', {
      overdue,
      household:
        household === 0
          ? t(several ? 'today.line.thisHouseholdPartNone' : 'today.line.householdPartNone')
          : several
            ? t(
                household === 1
                  ? 'today.line.thisHouseholdPartOne'
                  : 'today.line.thisHouseholdPartOther',
                { count: household },
              )
            : t(household === 1 ? 'today.line.householdPartOne' : 'today.line.householdPartOther', {
                count: household,
              }),
    });

  switch (line.kind) {
    case 'empty':
      return plain(t('today.line.empty'));
    case 'allDone':
      return plain(t('today.line.allDone'));
    case 'mine': {
      // The second line says what waits from earlier days and what is left for the household
      // (always, so the door never leaves it out) in one sentence, so it reads once (fase 10c).
      // With the filter on «Tú» there is no home line.
      const count = { count: line.overdue };
      if (line.today === 0) {
        const second =
          line.household === null
            ? t(
                line.overdue === 1 ? 'today.line.onlyOverdueOne' : 'today.line.onlyOverdueOther',
                count,
              )
            : joined(
                t(
                  line.overdue === 1
                    ? 'today.line.onlyOverduePartOne'
                    : 'today.line.onlyOverduePartOther',
                  count,
                ),
                line.household,
              );
        return { first: t('today.line.noneToday'), number: null, second };
      }
      const second =
        line.overdue === 0
          ? line.household === null
            ? null
            : householdSentence(line.household)
          : line.household === null
            ? t(line.overdue === 1 ? 'today.line.overdueOne' : 'today.line.overdueOther', count)
            : joined(
                t(
                  line.overdue === 1 ? 'today.line.overduePartOne' : 'today.line.overduePartOther',
                  count,
                ),
                line.household,
              );
      return {
        first: t(line.today === 1 ? 'today.line.mineOne' : 'today.line.mineOther', {
          count: line.today,
        }),
        number: String(line.today),
        second,
      };
    }
    case 'household':
      return {
        first: householdSentence(line.household),
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
