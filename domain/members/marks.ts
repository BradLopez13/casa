/** The five magnet colours, in the order members receive them. */
export const MAGNET_COLORS = ['teal', 'leaf', 'sky', 'pink', 'lilac'] as const;

export type MagnetColor = (typeof MAGNET_COLORS)[number];

export type MemberMark = { color: MagnetColor; initial: string };

type MarkInput = { userId: string; joinedAt: string; displayName: string };

// Code points that stay attached to the one before them: combining accents, variation
// selectors, emoji skin tones and emoji tag sequences.
const EXTENDS =
  /^[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE00-\uFE0F\uFE20-\uFE2F\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]$/u;
const REGIONAL_INDICATOR = /^[\u{1F1E6}-\u{1F1FF}]$/u;
const ZWJ = '\u200D';

/**
 * The first user-perceived character of a name, upper-cased. Hermes has no Intl.Segmenter, so
 * this covers what names realistically start with: accented letters (composed or not) and
 * emoji, including skin tones, flags and joined sequences.
 */
export function firstInitial(name: string): string {
  const points = Array.from(name.trim());
  const first = points[0];
  if (first === undefined) return '';
  let cluster = first;
  let i = 1;
  if (REGIONAL_INDICATOR.test(first) && points[1] && REGIONAL_INDICATOR.test(points[1])) {
    cluster += points[1];
    i = 2;
  }
  while (i < points.length) {
    const point = points[i] as string;
    const next = points[i + 1];
    if (EXTENDS.test(point)) {
      cluster += point;
      i += 1;
    } else if (point === ZWJ && next !== undefined) {
      cluster += point + next;
      i += 2;
    } else {
      break;
    }
  }
  return cluster.toUpperCase().normalize('NFC');
}

function joinedInstant(joinedAt: string): number {
  const instant = Date.parse(joinedAt);
  return Number.isNaN(instant) ? Number.POSITIVE_INFINITY : instant;
}

/**
 * A fixed mark for each member: colours go round the five magnet colours in join order (ties
 * broken by userId), so the same person keeps the same magnet on every screen and phone.
 */
export function memberMarks(members: readonly MarkInput[]): Map<string, MemberMark> {
  const ordered = [...members].sort(
    (a, b) =>
      joinedInstant(a.joinedAt) - joinedInstant(b.joinedAt) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
  return new Map(
    ordered.map((m, index) => [
      m.userId,
      {
        color: MAGNET_COLORS[index % MAGNET_COLORS.length] as MagnetColor,
        initial: firstInitial(m.displayName),
      },
    ]),
  );
}

/** Words that say nothing about a household: «Casa de la playa» is told apart by «playa». */
const FILLER = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'the', 'of', 'and']);

/** Letters and digits of a word, one per grapheme-ish code point, without marks or modifiers. */
const signs = (text: string) => Array.from(text).filter((c) => /[\p{L}\p{N}]/u.test(c));

/**
 * The initials of a person's households for their magnets (bloque 14.5, P3): one letter, unless
 * two households share it, and then two, so «Casa» and «Casa de prueba» are «Ca» and «CP», not two
 * «C». The second sign comes, in order, from the start of a later word that says something
 * («prueba», «2»), then from the name's own next letters; a pair still taken gets a number.
 */
export function houseInitials(names: readonly string[]): string[] {
  const first = names.map((name) => firstInitial(name).toLocaleUpperCase());
  const taken = new Set<string>();
  const out = names.map((_, i) => {
    const own = first[i] ?? '';
    const shared = first.filter((other) => other === own).length > 1;
    if (!shared) taken.add(own);
    return shared ? null : own;
  });
  names.forEach((name, i) => {
    if (out[i] !== null) return;
    const own = first[i] ?? '';
    const words = name.trim().split(/\s+/);
    const later = words
      .slice(1)
      .filter((word) => !FILLER.has(word.toLocaleLowerCase()))
      .map((word) => (signs(word)[0] ?? '').toLocaleUpperCase());
    const next = signs(words.join(''))
      .slice(1)
      .map((c) => c.toLocaleLowerCase());
    const candidates = [...later, ...next].filter((c) => c !== '').map((c) => own + c);
    let pick = candidates.find((c) => !taken.has(c));
    for (let n = 2; pick === undefined; n++) if (!taken.has(own + n)) pick = own + n;
    taken.add(pick);
    out[i] = pick;
  });
  return out as string[];
}
