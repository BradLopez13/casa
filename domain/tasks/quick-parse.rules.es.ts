import type { QuickRules } from './quick-parse';

// Spanish rules for quick parse. Every pattern runs over the FOLDED text (lower case, accents
// stripped, same length as the original), so words here are written without accents.

const WEEKDAYS = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
} as const;

const MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
} as const;

const ROOMS = {
  cocina: 'kitchen',
  bano: 'bathroom',
  aseo: 'bathroom',
  salon: 'living_room',
  dormitorio: 'bedroom',
  habitacion: 'bedroom',
  lavadero: 'laundry',
  exterior: 'outdoor',
  jardin: 'outdoor',
  terraza: 'outdoor',
  otra: 'other',
} as const;

const RELATIVE = { 'pasado manana': 2, manana: 1, hoy: 0 } as const;

/** Longest first, so «pasado manana» wins over «manana». */
const alt = (words: object) =>
  Object.keys(words)
    .sort((a, b) => b.length - a.length)
    .join('|');

const day = alt(WEEKDAYS);
const room = alt(ROOMS);

export const RULES_ES: QuickRules = {
  relative: new RegExp(`(?:para )?(?<rel>${alt(RELATIVE)})`, 'g'),
  relativeOffsets: RELATIVE,
  // «Comprar pan de mañana» is a noun phrase; «por la mañana», «esta mañana», «cada mañana» a
  // time of day.
  relativeGuards: ['de', 'la', 'esta', 'cada'],
  weekday: new RegExp(`(?:para )?el (?<day>${day})`, 'g'),
  dayOfMonth: new RegExp(
    `(?:para )?el (?:dia )?(?<day>\\d{1,2})(?: de (?<month>${alt(MONTHS)}))?`,
    'g',
  ),
  everyDay: /cada dia|todos los dias/g,
  everyWeekdays: new RegExp(`cada (?<days>(?:${day})(?:(?:, ?| y )(?:${day}))*)`, 'g'),
  weekdayListSeparator: /, ?| y /,
  everyN: /cada (?<n>\d{1,3}) dias/g,
  everyWeek: /cada semana|todas las semanas/g,
  everyMonth: /cada mes|todos los meses/g,
  assigneeLead: /para |@/g,
  assigneePrefixLeads: ['@'],
  assigneeStopwords: ['el', 'la', 'los', 'las', 'mi', 'tu', 'su', 'un', 'una', 'que'],
  roomPhrase: new RegExp(`en (?:el |la )?(?<room>${room})`, 'g'),
  roomBare: new RegExp(`(?:(?:del|de la|el|la) )?(?<room>${room})`, 'g'),
  roomBareExcluded: ['otra'],
  weekdays: WEEKDAYS,
  months: MONTHS,
  rooms: ROOMS,
};
