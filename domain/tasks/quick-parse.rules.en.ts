import type { QuickRules } from './quick-parse';

// English rules for quick parse (minimal; extended with the English UI). Patterns run over the
// FOLDED text (lower case, accents stripped, same length as the original).

const WEEKDAYS = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
} as const;

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
} as const;

const ROOMS = {
  kitchen: 'kitchen',
  bathroom: 'bathroom',
  'living room': 'living_room',
  bedroom: 'bedroom',
  laundry: 'laundry',
  garden: 'outdoor',
  terrace: 'outdoor',
  outside: 'outdoor',
  other: 'other',
} as const;

const RELATIVE = { 'day after tomorrow': 2, tomorrow: 1, today: 0 } as const;

/** Longest first, so «day after tomorrow» wins over «tomorrow». */
const alt = (words: object) =>
  Object.keys(words)
    .sort((a, b) => b.length - a.length)
    .join('|');

const day = alt(WEEKDAYS);
const room = alt(ROOMS);

export const RULES_EN: QuickRules = {
  relative: new RegExp(`(?:the )?(?<rel>${alt(RELATIVE)})`, 'g'),
  relativeOffsets: RELATIVE,
  relativeGuards: [],
  weekday: new RegExp(`on (?<day>${day})`, 'g'),
  dayOfMonth: new RegExp(
    `on (?:the )?(?<day>\\d{1,2})(?:st|nd|rd|th)?(?: of (?<month>${alt(MONTHS)}))?`,
    'g',
  ),
  everyDay: /every day|daily/g,
  everyWeekdays: new RegExp(`every (?<days>(?:${day})(?:(?:, ?| and )(?:${day}))*)`, 'g'),
  weekdayListSeparator: /, ?| and /,
  everyN: /every (?<n>\d{1,3}) days/g,
  everyWeek: /every week|weekly/g,
  everyMonth: /every month|monthly/g,
  assigneeLead: /for |@/g,
  roomPhrase: new RegExp(`in (?:the )?(?<room>${room})`, 'g'),
  roomBare: new RegExp(`(?:the )?(?<room>${room})`, 'g'),
  roomBareExcluded: ['other'],
  weekdays: WEEKDAYS,
  months: MONTHS,
  rooms: ROOMS,
};
