/** The five magnet colours, in the order members receive them. */
export const MAGNET_COLORS = ['mustard', 'sage', 'coral', 'petrol', 'pink'] as const;

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
