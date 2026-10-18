import type { QuickRules } from './quick-parse';

// English rules for quick parse, with the same coverage as the Spanish ones. Patterns run over
// the FOLDED text (lower case, accents stripped, same length as the original).

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
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
} as const;

const ROOMS = {
  kitchen: 'kitchen',
  bathroom: 'bathroom',
  toilet: 'bathroom',
  'living room': 'living_room',
  lounge: 'living_room',
  bedroom: 'bedroom',
  'laundry room': 'laundry',
  laundry: 'laundry',
  garden: 'outdoor',
  yard: 'outdoor',
  terrace: 'outdoor',
  patio: 'outdoor',
  balcony: 'outdoor',
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
const month = alt(MONTHS);
const room = alt(ROOMS);
const suffix = '(?:st|nd|rd|th)?';

export const RULES_EN: QuickRules = {
  // «tomorrow's lunch» is a noun phrase, not a date.
  relative: new RegExp(`(?:for )?(?<rel>${alt(RELATIVE)})(?!'s)`, 'g'),
  relativeOffsets: RELATIVE,
  // «the world of tomorrow» is not a date.
  relativeGuards: ['of'],
  weekday: new RegExp(`(?:on |for )(?<day>${day})`, 'g'),
  // «on the 23rd», «on 23 october», «on the 23rd of october», «on october 23», «october 23».
  dayOfMonth: new RegExp(
    `on (?:the )?(?<day>\\d{1,2})${suffix}(?: (?:of )?(?<month>${month}))?|(?:on )?(?<monthAlt>${month}) (?:the )?(?<dayAlt>\\d{1,2})${suffix}`,
    'g',
  ),
  everyDay: /every day|each day|daily/g,
  everyWeekdays: new RegExp(`every (?<days>(?:${day})(?:(?:, ?| and |, and )(?:${day}))*)`, 'g'),
  weekdayListSeparator: /, and |, ?| and /,
  everyN: /every (?<n>\d{1,3}) days/g,
  everyWeek: /every week|each week|weekly/g,
  everyMonth: /every month|each month|monthly/g,
  assigneeLead: /for |@/g,
  assigneePrefixLeads: ['@'],
  assigneeStopwords: [
    'the',
    'a',
    'an',
    'my',
    'your',
    'his',
    'her',
    'our',
    'their',
    'me',
    'us',
    'him',
    'them',
    'you',
    'it',
    'this',
    'that',
  ],
  roomPhrase: new RegExp(`(?:in|on) (?:the )?(?<room>${room})`, 'g'),
  roomBare: new RegExp(`(?:the )?(?<room>${room})`, 'g'),
  // «Do the laundry», «Clean the toilet»: the thing to clean, not where.
  roomBareExcluded: ['other', 'outside', 'laundry', 'toilet'],
  weekdays: WEEKDAYS,
  months: MONTHS,
  rooms: ROOMS,
};
