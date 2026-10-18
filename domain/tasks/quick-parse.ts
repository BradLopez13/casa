import type { RecurrenceRule } from '@/domain/recurrence/rule';
import { addDays, isoWeekday, type IsoWeekday } from './dates';
import type { Room } from './rooms';
import { RULES_EN } from './quick-parse.rules.en';
import { RULES_ES } from './quick-parse.rules.es';

export type QuickSpanKind = 'due' | 'repeat' | 'assignee' | 'room';

/** A recognised expression; indices point into the ORIGINAL text. */
export type QuickSpan = { start: number; end: number; kind: QuickSpanKind };

export type QuickParse = {
  title: string;
  dueOn: string | null;
  recurrence: RecurrenceRule | null;
  assigneeId: string | null;
  room: Room | null;
  spans: QuickSpan[];
};

export type QuickParseContext = {
  today: string;
  members: { id: string; name: string }[];
  locale: 'es' | 'en';
  /** Kinds the person has dismissed; their words stay in the title. */
  disabled?: ReadonlySet<QuickSpanKind>;
};

/** One language's rules. Every pattern is global and runs over the folded text. */
export type QuickRules = {
  /** Group `rel`: a key of `relativeOffsets`. */
  relative: RegExp;
  relativeOffsets: Readonly<Record<string, number>>;
  /**
   * A relative word right after one of these words is not a date: a noun phrase («pan de
   * mañana») or a time of day («por la mañana», «esta mañana»).
   */
  relativeGuards: readonly string[];
  /** Group `day`: a key of `weekdays`. */
  weekday: RegExp;
  /**
   * Group `day`: digits; optional group `month`: a key of `months`. A language that also writes
   * the month first («october 23») uses `dayAlt` and `monthAlt` for that order.
   */
  dayOfMonth: RegExp;
  everyDay: RegExp;
  /** Group `days`: weekday names joined by `weekdayListSeparator`. */
  everyWeekdays: RegExp;
  weekdayListSeparator: RegExp;
  /** Group `n`: digits. */
  everyN: RegExp;
  everyWeek: RegExp;
  everyMonth: RegExp;
  /** What comes right before a member's name («para », «@»). */
  assigneeLead: RegExp;
  /** Leads after which a unique prefix of a name is enough («@seg»); others need a whole word. */
  assigneePrefixLeads: readonly string[];
  /** Words after a lead that are never a name («para el perro»). */
  assigneeStopwords: readonly string[];
  /** Group `room`: a key of `rooms`, anywhere. */
  roomPhrase: RegExp;
  /** Group `room`: a key of `rooms`, only when nothing but other expressions follows it. */
  roomBare: RegExp;
  roomBareExcluded: readonly string[];
  weekdays: Readonly<Record<string, IsoWeekday>>;
  months: Readonly<Record<string, number>>;
  rooms: Readonly<Record<string, Room>>;
};

const RULES: Record<QuickParseContext['locale'], QuickRules> = { es: RULES_ES, en: RULES_EN };

const ACCENTS = new Map(
  [...'áéíóúàèìòùäëïöüâêîôûñç'].map((char, i) => [char, 'aeiouaeiouaeiouaeiounc'[i] ?? char]),
);

/** Lower case without accents, one code unit per code unit so indices match the original. */
export function fold(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const lower = char.toLowerCase();
    const single = lower.length === 1 ? lower : char;
    out += ACCENTS.get(single) ?? single;
  }
  return out;
}

const WORD = /[\p{L}\p{N}]/u;
const isWordChar = (char: string | undefined) => char !== undefined && WORD.test(char);

/** True when [start, end) does not cut through a word. */
function bounded(folded: string, start: number, end: number): boolean {
  return !isWordChar(folded[start - 1]) && !isWordChar(folded[end]);
}

const anchored = new WeakMap<RegExp, RegExp>();

/**
 * The rule pattern behind a «not after a letter or digit» lookbehind, so a match that would start
 * inside a word is never tried and cannot hide a valid one right after it («Prepara mañana»:
 * «para mañana» starts inside «Prepara», «mañana» alone is still found).
 */
function startAtWord(pattern: RegExp): RegExp {
  let compiled = anchored.get(pattern);
  if (!compiled) {
    compiled = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern.source})`, 'gu');
    anchored.set(pattern, compiled);
  }
  return compiled;
}

/**
 * Matches that start, and unless `openEnd` also end, on a word boundary. Walked with `exec`, not
 * `matchAll`: on Hermes (the app's engine) the matches `matchAll` yields come without `groups`,
 * and every rule reads its named groups.
 */
function* matches(pattern: RegExp, folded: string, openEnd = false) {
  const re = startAtWord(pattern);
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(folded)) !== null) {
    // An empty match would never move the cursor.
    if (match[0] === '') re.lastIndex++;
    const start = match.index;
    const end = start + match[0].length;
    if (openEnd || bounded(folded, start, end)) yield { start, end, groups: match.groups ?? {} };
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The first date ≥ today on day `day` of a month, trying up to a year ahead. */
function nextDayOfMonth(today: string, day: number): string | null {
  const [year = 0, month = 1] = today.split('-').map(Number);
  for (let k = 0; k < 13; k++) {
    const y = year + Math.floor((month - 1 + k) / 12);
    const m = ((month - 1 + k) % 12) + 1;
    if (day > daysInMonth(y, m)) continue;
    const iso = `${y}-${pad(m)}-${pad(day)}`;
    if (iso >= today) return iso;
  }
  return null;
}

/** The first date ≥ today on `day` `month`, trying up to eight years ahead (for 29 Feb). */
function nextDayOfYear(today: string, month: number, day: number): string | null {
  const year = Number(today.slice(0, 4));
  for (let y = year; y <= year + 8; y++) {
    if (day > daysInMonth(y, month)) continue;
    const iso = `${y}-${pad(month)}-${pad(day)}`;
    if (iso >= today) return iso;
  }
  return null;
}

/** Today when it is that weekday, else the next one. */
function nextWeekday(today: string, day: IsoWeekday): string {
  return addDays(today, (day - isoWeekday(today) + 7) % 7);
}

type Candidate = { start: number; end: number; apply: (draft: Draft) => void };

type Draft = {
  dueOn: string | null;
  repeat: ((dueOn: string | null) => RecurrenceRule) | null;
  assigneeId: string | null;
  room: Room | null;
};

function dueCandidates(folded: string, rules: QuickRules, today: string): Candidate[] {
  const out: Candidate[] = [];
  for (const { start, end, groups } of matches(rules.relative, folded)) {
    const offset = rules.relativeOffsets[groups.rel ?? ''];
    if (offset === undefined) continue;
    const before = folded.slice(0, start).trimEnd();
    if (
      rules.relativeGuards.some(
        (guard) =>
          before.endsWith(guard) && bounded(before, before.length - guard.length, before.length),
      )
    )
      continue;
    const dueOn = addDays(today, offset);
    out.push({ start, end, apply: (d) => (d.dueOn = dueOn) });
  }
  for (const { start, end, groups } of matches(rules.weekday, folded)) {
    const day = rules.weekdays[groups.day ?? ''];
    if (day === undefined) continue;
    const dueOn = nextWeekday(today, day);
    out.push({ start, end, apply: (d) => (d.dueOn = dueOn) });
  }
  for (const { start, end, groups } of matches(rules.dayOfMonth, folded)) {
    const day = Number(groups.day ?? groups.dayAlt);
    if (!(day >= 1 && day <= 31)) continue;
    const monthName = groups.month ?? groups.monthAlt;
    const month = monthName === undefined ? undefined : rules.months[monthName];
    const dueOn =
      month === undefined ? nextDayOfMonth(today, day) : nextDayOfYear(today, month, day);
    if (dueOn === null) continue;
    out.push({ start, end, apply: (d) => (d.dueOn = dueOn) });
  }
  return out;
}

function repeatCandidates(folded: string, rules: QuickRules, today: string): Candidate[] {
  const out: Candidate[] = [];
  const push = (start: number, end: number, repeat: NonNullable<Draft['repeat']>) =>
    out.push({ start, end, apply: (d) => (d.repeat = repeat) });

  for (const { start, end } of matches(rules.everyDay, folded))
    push(start, end, () => ({ kind: 'interval', every: 1 }));
  for (const { start, end, groups } of matches(rules.everyWeekdays, folded)) {
    const days = (groups.days ?? '')
      .split(rules.weekdayListSeparator)
      .map((name) => rules.weekdays[name.trim()])
      .filter((day): day is IsoWeekday => day !== undefined);
    const unique = [...new Set(days)].sort((a, b) => a - b);
    if (unique.length > 0) push(start, end, () => ({ kind: 'weekly', days: unique }));
  }
  for (const { start, end, groups } of matches(rules.everyN, folded)) {
    const every = Number(groups.n);
    if (every >= 1 && every <= 365) push(start, end, () => ({ kind: 'interval', every }));
  }
  for (const { start, end } of matches(rules.everyWeek, folded))
    push(start, end, (dueOn) => ({ kind: 'weekly', days: [isoWeekday(dueOn ?? today)] }));
  for (const { start, end } of matches(rules.everyMonth, folded))
    push(start, end, (dueOn) => ({ kind: 'monthly', day: Number((dueOn ?? today).slice(8, 10)) }));
  return out;
}

function assigneeCandidates(
  folded: string,
  rules: QuickRules,
  members: QuickParseContext['members'],
): Candidate[] {
  const names = members.map((m) => ({ id: m.id, name: fold(m.name).trim().replace(/\s+/g, ' ') }));
  const out: Candidate[] = [];
  for (const { start, end: at } of matches(rules.assigneeLead, folded, true)) {
    const lead = folded.slice(start, at);
    const rest = folded.slice(at);
    const token = /^[\p{L}\p{N}]+/u.exec(rest)?.[0];
    // «para el perro», «para la cena», «para mi»: never a name, whoever lives in the house.
    if (!token || rules.assigneeStopwords.includes(token)) continue;

    // A full name wins, the longest one first («Ana María» over «Ana»).
    const exact = names
      .filter(
        (m) => m.name.length > 0 && rest.startsWith(m.name) && !isWordChar(rest[m.name.length]),
      )
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (exact) {
      out.push({ start, end: at + exact.name.length, apply: (d) => (d.assigneeId = exact.id) });
      continue;
    }

    // Otherwise one word: the whole first word of exactly one member's name or, after a prefix
    // lead («@seg»), the start of exactly one member's name.
    const prefixAllowed = rules.assigneePrefixLeads.includes(lead) && token.length >= 2;
    const fitting = names.filter((m) =>
      prefixAllowed ? m.name.startsWith(token) : m.name.split(' ')[0] === token,
    );
    const only = fitting.length === 1 ? fitting[0] : undefined;
    if (only) out.push({ start, end: at + token.length, apply: (d) => (d.assigneeId = only.id) });
  }
  return out;
}

function roomCandidates(folded: string, rules: QuickRules, claimed: QuickSpan[]): Candidate[] {
  const out: Candidate[] = [];
  for (const { start, end, groups } of matches(rules.roomPhrase, folded)) {
    const room = rules.rooms[groups.room ?? ''];
    if (room !== undefined) out.push({ start, end, apply: (d) => (d.room = room) });
  }
  for (const { start, end, groups } of matches(rules.roomBare, folded)) {
    const word = groups.room ?? '';
    const room = rules.rooms[word];
    if (room === undefined || rules.roomBareExcluded.includes(word)) continue;
    if (!onlyClaimedAfter(folded, end, claimed)) continue;
    out.push({ start, end, apply: (d) => (d.room = room) });
  }
  return out;
}

/** True when everything from `from` on is whitespace, punctuation or already claimed. */
function onlyClaimedAfter(folded: string, from: number, claimed: QuickSpan[]): boolean {
  for (let i = from; i < folded.length; i++) {
    if (claimed.some((s) => i >= s.start && i < s.end)) continue;
    if (isWordChar(folded[i])) return false;
  }
  return true;
}

function titleWithout(text: string, spans: QuickSpan[]): string {
  let out = '';
  let at = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    out += text.slice(at, span.start) + ' ';
    at = span.end;
  }
  out += text.slice(at);
  return out.replace(/\s+/g, ' ').trim();
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end;

/**
 * Reads dates, repetition, assignee and room out of a quick-add line. Kinds are tried in
 * order — repetition, date, assignee, room — so members win over room words; per kind the
 * leftmost expression that overlaps nothing claimed yet is taken. An expression that would
 * leave the title empty is not applied, so «mañana» alone stays a title.
 */
export function quickParse(text: string, ctx: QuickParseContext): QuickParse {
  const rules = RULES[ctx.locale];
  const folded = fold(text);
  const disabled = ctx.disabled ?? new Set<QuickSpanKind>();
  const spans: QuickSpan[] = [];
  const draft: Draft = { dueOn: null, repeat: null, assigneeId: null, room: null };

  const finders: [QuickSpanKind, () => Candidate[]][] = [
    ['repeat', () => repeatCandidates(folded, rules, ctx.today)],
    ['due', () => dueCandidates(folded, rules, ctx.today)],
    ['assignee', () => assigneeCandidates(folded, rules, ctx.members)],
    ['room', () => roomCandidates(folded, rules, spans)],
  ];

  for (const [kind, find] of finders) {
    if (disabled.has(kind)) continue;
    const pick = find()
      .filter((c) => !spans.some((s) => overlaps(s, c)))
      .sort((a, b) => a.start - b.start || b.end - a.end)[0];
    if (!pick) continue;
    const span: QuickSpan = { start: pick.start, end: pick.end, kind };
    if (titleWithout(text, [...spans, span]) === '') continue;
    spans.push(span);
    pick.apply(draft);
  }

  spans.sort((a, b) => a.start - b.start);
  return {
    title: titleWithout(text, spans),
    dueOn: draft.dueOn,
    recurrence: draft.repeat ? draft.repeat(draft.dueOn) : null,
    assigneeId: draft.assigneeId,
    room: draft.room,
    spans,
  };
}

/** Dismisses one recognised expression: re-parses with that kind off, so its words return to the title. */
export function dropSpan(
  parse: QuickParse,
  kind: QuickSpanKind,
  original: string,
  ctx: QuickParseContext,
): QuickParse {
  if (!parse.spans.some((s) => s.kind === kind)) return parse;
  return quickParse(original, { ...ctx, disabled: new Set([...(ctx.disabled ?? []), kind]) });
}
