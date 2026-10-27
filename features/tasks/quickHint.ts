import { quickParse, type QuickParseContext } from '@/domain/tasks/quick-parse';
import { isLargeText } from '@/ui/door';

/** A run of the hint's example: `known` when the quick add would pick it out. */
export type HintSegment = { text: string; known: boolean };

/**
 * The quick add's example cut where the parser itself finds a date, repeat, person or room, so
 * the hint underlines exactly what the field would understand.
 */
export function quickHintSegments(example: string, ctx: QuickParseContext): HintSegment[] {
  const spans = [...quickParse(example, ctx).spans].sort((a, b) => a.start - b.start);
  const segments: HintSegment[] = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) segments.push({ text: example.slice(at, span.start), known: false });
    segments.push({ text: example.slice(span.start, span.end), known: true });
    at = span.end;
  }
  if (at < example.length) segments.push({ text: example.slice(at), known: false });
  return segments;
}

/**
 * Who the example is for: someone else of the household, or the person themself when alone, by
 * the first word of the name. Null before the members load.
 */
export function hintName(
  members: readonly { id: string; name: string }[],
  userId: string | null,
): string | null {
  const other = members.find((m) => m.id !== userId) ?? members[0];
  return other?.name.trim().split(/\s+/)[0] ?? null;
}

/**
 * Whether the quick add's example shows under the empty field. At the default text it shows until
 * used. From ×1.3 two lines of example cost the second note in view (bloque 11): it keeps quiet
 * while the list has notes, whatever hint the list has, and comes back with the list empty, where
 * it is the only one. It is always in «Cómo funciona Nido».
 */
export function quickHintShown({
  open,
  fontScale,
  hasNotes,
}: {
  open: boolean;
  fontScale: number;
  hasNotes: boolean;
}): boolean {
  if (!open) return false;
  return !isLargeText(fontScale) || !hasNotes;
}
