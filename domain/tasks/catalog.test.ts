import { describe, expect, it } from 'vitest';
import { recurrenceRuleSchema } from '@/domain/recurrence/rule';
import { t } from '@/i18n';
import {
  CATALOG,
  CATALOG_ROOMS,
  catalogFor,
  catalogInputs,
  catalogLabel,
  catalogTitle,
  normalizeTaskTitle,
  offeredRooms,
} from './catalog';
import { ROOMS } from './rooms';

const today = '2026-10-09';

describe('CATALOG', () => {
  it('has about six tasks for every room but «other», and for the whole house', () => {
    for (const room of ROOMS) {
      if (room === 'other') expect(CATALOG.other).toEqual([]);
      else expect(CATALOG[room]).toHaveLength(6);
    }
    expect(CATALOG.general).toHaveLength(6);
  });

  it('has valid rules, unique keys per room and unique titles overall', () => {
    const titles = new Set<string>();
    let count = 0;
    for (const items of Object.values(CATALOG)) {
      expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
      for (const item of items) {
        if (item.recurrence) {
          expect(recurrenceRuleSchema.safeParse(item.recurrence).success).toBe(true);
        }
        titles.add(normalizeTaskTitle(t(item.titleKey)));
        count += 1;
      }
    }
    expect(titles.size).toBe(count);
  });
});

describe('normalizeTaskTitle', () => {
  it('folds case, accents and spaces', () => {
    expect(normalizeTaskTitle('  Cambiar   las SÁBANAS ')).toBe('cambiar las sabanas');
  });
});

describe('catalogFor', () => {
  it('offers only the household rooms and the whole house, without what it already has', () => {
    const groups = catalogFor(['kitchen'], new Set(['sacar la basura']));
    expect(groups.map((group) => group.room)).toEqual(['kitchen', 'general']);
    const titles = groups.flatMap((group) => group.items.map(catalogTitle));
    expect(titles).not.toContain('Sacar la basura');
    expect(titles).not.toContain('Limpiar el baño');
    expect(titles).toContain('Fregar los platos');
    expect(groups[0]?.items).toHaveLength(5);
  });

  it('follows the room order, whatever order the household keeps', () => {
    const groups = catalogFor(['bathroom', 'kitchen'], new Set());
    expect(groups.map((group) => group.room)).toEqual(['kitchen', 'bathroom', 'general']);
  });

  it('drops a room whose tasks the household already has, and «other» which has none', () => {
    const kitchen = new Set(CATALOG.kitchen.map((item) => normalizeTaskTitle(catalogTitle(item))));
    const groups = catalogFor(['kitchen', 'other'], kitchen);
    expect(groups.map((group) => group.room)).toEqual(['general']);
  });
});

describe('catalogInputs (today = Friday 2026-10-09)', () => {
  const picks = catalogInputs(
    ['general.bills', 'kitchen.dishes', 'bathroom.paper', 'kitchen.trash'],
    today,
  );

  it('returns the picks in catalogue order, each with its id', () => {
    expect(picks.map((pick) => pick.id)).toEqual([
      'kitchen.dishes',
      'kitchen.trash',
      'bathroom.paper',
      'general.bills',
    ]);
  });

  it('dates a repeating task on its first day and leaves a one-off one undated', () => {
    expect(picks.map((pick) => pick.input.dueOn)).toEqual([
      '2026-10-09',
      '2026-10-12',
      null,
      '2026-11-05',
    ]);
    expect(picks[2]?.input.recurrence).toBeNull();
  });

  it('takes the room from the group, none for the whole house, and leaves everyone free', () => {
    expect(picks.map((pick) => pick.input.room)).toEqual(['kitchen', 'kitchen', 'bathroom', null]);
    expect(picks.every((pick) => pick.input.assigneeId === null)).toBe(true);
    expect(picks[0]?.input.title).toBe('Fregar los platos');
  });

  it('ignores unknown ids', () => {
    expect(catalogInputs(['garage.paint', 'kitchen.nothing'], today)).toEqual([]);
  });
});

describe('offeredRooms', () => {
  it('offers the household rooms in the usual order', () => {
    expect(offeredRooms(['bedroom', 'kitchen'], null)).toEqual(['kitchen', 'bedroom']);
  });

  it('keeps the task room even when the household does not have it', () => {
    expect(offeredRooms(['kitchen'], 'outdoor')).toEqual(['kitchen', 'outdoor']);
  });

  it('offers every room while the household rooms are unknown', () => {
    expect(offeredRooms(undefined, null)).toEqual([...ROOMS]);
  });
});

describe('catalogInputs for a person', () => {
  it('gives every pick to the chosen person', () => {
    const picks = catalogInputs(['kitchen.dishes', 'general.bills'], today, 'u-2');
    expect(picks.map((pick) => pick.input.assigneeId)).toEqual(['u-2', 'u-2']);
  });
});

describe('catalogLabel', () => {
  const find = (key: string) => CATALOG.kitchen.find((item) => item.key === key);

  it('joins the chore and its repeat with a middle dot, the repeat in lower case', () => {
    const dishes = find('dishes');
    expect(dishes && catalogLabel(dishes)).toBe('Fregar los platos · cada día');
  });

  it('is the chore alone when it does not repeat', () => {
    const once = CATALOG_ROOMS.flatMap((room) => CATALOG[room]).find((i) => i.recurrence === null);
    expect(once && catalogLabel(once)).toBe(once && catalogTitle(once));
  });
});
