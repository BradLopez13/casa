import { firstDueOn } from '@/domain/recurrence/next';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
import { normalizeItemName } from '@/domain/shopping/normalize';
import { t, type MessageKey } from '@/i18n';
import type { TaskInput } from './input';
import { ROOMS, type Room } from './rooms';

/** A room of the house, or the whole house for chores that belong to none. */
export type CatalogRoom = Room | 'general';

export type CatalogItem = {
  key: string;
  titleKey: MessageKey;
  /** The suggested repeat; null for a chore done when it is needed. */
  recurrence: RecurrenceRule | null;
};

/** The groups in the order the catalogue shows them: the rooms, then the whole house. */
export const CATALOG_ROOMS: readonly CatalogRoom[] = [...ROOMS, 'general'];

const item = (
  key: string,
  titleKey: MessageKey,
  recurrence: RecurrenceRule | null,
): CatalogItem => ({ key, titleKey, recurrence });

/** Typical chores for each room, with the repeat a household usually gives them. */
export const CATALOG: Record<CatalogRoom, readonly CatalogItem[]> = {
  kitchen: [
    item('dishes', 'catalog.kitchen.dishes', { kind: 'interval', every: 1 }),
    item('trash', 'catalog.kitchen.trash', { kind: 'weekly', days: [1, 4] }),
    item('fridge', 'catalog.kitchen.fridge', { kind: 'monthly', day: 1 }),
    item('oven', 'catalog.kitchen.oven', { kind: 'monthly', day: 15 }),
    item('cloth', 'catalog.kitchen.cloth', { kind: 'weekly', days: [1] }),
    item('sweep', 'catalog.kitchen.sweep', { kind: 'interval', every: 2 }),
  ],
  bathroom: [
    item('clean', 'catalog.bathroom.clean', { kind: 'weekly', days: [6] }),
    item('towels', 'catalog.bathroom.towels', { kind: 'weekly', days: [7] }),
    item('mirror', 'catalog.bathroom.mirror', { kind: 'weekly', days: [3] }),
    item('paper', 'catalog.bathroom.paper', null),
    item('shower', 'catalog.bathroom.shower', { kind: 'interval', every: 14 }),
    item('drain', 'catalog.bathroom.drain', { kind: 'monthly', day: 10 }),
  ],
  living_room: [
    item('vacuum', 'catalog.living_room.vacuum', { kind: 'weekly', days: [3, 6] }),
    item('dust', 'catalog.living_room.dust', { kind: 'weekly', days: [5] }),
    item('plants', 'catalog.living_room.plants', { kind: 'interval', every: 3 }),
    item('tidy', 'catalog.living_room.tidy', { kind: 'weekly', days: [7] }),
    item('windows', 'catalog.living_room.windows', { kind: 'monthly', day: 20 }),
    item('cushions', 'catalog.living_room.cushions', { kind: 'weekly', days: [6] }),
  ],
  bedroom: [
    item('sheets', 'catalog.bedroom.sheets', { kind: 'interval', every: 14 }),
    item('bed', 'catalog.bedroom.bed', { kind: 'interval', every: 1 }),
    item('wardrobe', 'catalog.bedroom.wardrobe', { kind: 'monthly', day: 5 }),
    item('vacuum', 'catalog.bedroom.vacuum', { kind: 'weekly', days: [4] }),
    item('air', 'catalog.bedroom.air', { kind: 'interval', every: 1 }),
    item('duvet', 'catalog.bedroom.duvet', null),
  ],
  laundry: [
    item('wash', 'catalog.laundry.wash', { kind: 'interval', every: 3 }),
    item('hang', 'catalog.laundry.hang', { kind: 'interval', every: 3 }),
    item('collect', 'catalog.laundry.collect', { kind: 'interval', every: 3 }),
    item('iron', 'catalog.laundry.iron', { kind: 'weekly', days: [7] }),
    item('filter', 'catalog.laundry.filter', { kind: 'monthly', day: 1 }),
    item('fold', 'catalog.laundry.fold', { kind: 'interval', every: 3 }),
  ],
  outdoor: [
    item('sweep', 'catalog.outdoor.sweep', { kind: 'weekly', days: [6] }),
    item('water', 'catalog.outdoor.water', { kind: 'interval', every: 2 }),
    item('barbecue', 'catalog.outdoor.barbecue', null),
    item('prune', 'catalog.outdoor.prune', { kind: 'monthly', day: 1 }),
    item('leaves', 'catalog.outdoor.leaves', { kind: 'weekly', days: [7] }),
    item('furniture', 'catalog.outdoor.furniture', { kind: 'monthly', day: 1 }),
  ],
  // «Otra» is whatever the household means by it: nothing typical to offer.
  other: [],
  general: [
    item('shopping', 'catalog.general.shopping', { kind: 'weekly', days: [6] }),
    item('expired', 'catalog.general.expired', { kind: 'weekly', days: [7] }),
    item('filters', 'catalog.general.filters', { kind: 'monthly', day: 1 }),
    item('bulbs', 'catalog.general.bulbs', null),
    item('firstAid', 'catalog.general.firstAid', { kind: 'monthly', day: 1 }),
    item('bills', 'catalog.general.bills', { kind: 'monthly', day: 5 }),
  ],
};

export function catalogTitle(entry: CatalogItem): string {
  return t(entry.titleKey);
}

/** How a task title is compared with the catalogue: lower case, no accents, single spaces. */
export function normalizeTaskTitle(title: string): string {
  return normalizeItemName(title);
}

/** One id per catalogue entry, unique across groups: «kitchen.trash». */
export function catalogId(room: CatalogRoom, entry: CatalogItem): string {
  return `${room}.${entry.key}`;
}

export type CatalogGroup = { room: CatalogRoom; items: CatalogItem[] };

/**
 * What the catalogue offers a household: its rooms (in the usual order) and the whole house,
 * without the chores it already has (by normalised title). Empty groups are left out.
 */
export function catalogFor(
  rooms: readonly Room[],
  existingNormalized: ReadonlySet<string>,
): CatalogGroup[] {
  return CATALOG_ROOMS.filter((room) => room === 'general' || rooms.includes(room))
    .map((room) => ({
      room,
      items: CATALOG[room].filter(
        (entry) => !existingNormalized.has(normalizeTaskTitle(catalogTitle(entry))),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * The tasks to create for the chosen ids, in catalogue order: unassigned, in the group's room
 * (none for the whole house), due on the repeat's first day or undated when it does not repeat.
 */
export function catalogInputs(
  ids: readonly string[],
  today: string,
): { id: string; input: TaskInput }[] {
  const chosen = new Set(ids);
  return CATALOG_ROOMS.flatMap((room) =>
    CATALOG[room]
      .filter((entry) => chosen.has(catalogId(room, entry)))
      .map((entry) => ({
        id: catalogId(room, entry),
        input: {
          title: catalogTitle(entry),
          room: room === 'general' ? null : room,
          assigneeId: null,
          dueOn: entry.recurrence ? firstDueOn(entry.recurrence, today) : null,
          recurrence: entry.recurrence,
        },
      })),
  );
}

/**
 * The rooms the task form offers: the household's, in the usual order, plus the task's own room
 * if the household no longer has it, so editing never loses it. Every room until the household
 * is known.
 */
export function offeredRooms(household: readonly Room[] | undefined, current: Room | null): Room[] {
  if (household === undefined) return [...ROOMS];
  return ROOMS.filter((room) => household.includes(room) || room === current);
}
