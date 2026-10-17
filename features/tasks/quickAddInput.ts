import { syncMonthly } from '@/domain/recurrence/form';
import type { TaskInput } from '@/domain/tasks/input';
import {
  quickParse,
  type QuickParseContext,
  type QuickSpan,
  type QuickSpanKind,
} from '@/domain/tasks/quick-parse';

export type QuickAddContext = QuickParseContext;

/**
 * What the quick-add field creates from what was typed. Dates, repeats, people and rooms written
 * in the text are taken out of the title and fill those fields; anything not written falls back
 * to the given person and day. A repeat with no date starts on the given day. Null when there is
 * nothing to add. The single entry point for the field's text.
 */
export function quickAddInput(
  text: string,
  assigneeId: string | null,
  dueOn: string,
  ctx: QuickAddContext,
): TaskInput | null {
  const raw = text.trim();
  if (raw === '') return null;
  const parse = quickParse(raw, ctx);
  return {
    title: parse.title === '' ? raw : parse.title,
    room: parse.room,
    assigneeId: parse.assigneeId ?? assigneeId,
    dueOn: parse.dueOn ?? dueOn,
    recurrence: parse.recurrence,
  };
}

/** The parser's language, from the app's one locale. */
export function quickLocale(appLocale: string): QuickParseContext['locale'] {
  return appLocale.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/** The text cut into plain runs and recognised ones, in order, for drawing it highlighted. */
export function highlightRuns(
  text: string,
  spans: readonly QuickSpan[],
): { text: string; kind: QuickSpanKind | null }[] {
  const runs: { text: string; kind: QuickSpanKind | null }[] = [];
  let at = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start > at) runs.push({ text: text.slice(at, span.start), kind: null });
    runs.push({ text: text.slice(span.start, span.end), kind: span.kind });
    at = span.end;
  }
  if (at < text.length) runs.push({ text: text.slice(at), kind: null });
  return runs;
}

/**
 * The task form's values with what its title says: each date, repeat, person or room written in
 * the title fills that field unless the person chose it by hand (`touched`, which the parse also
 * skips, so those words stay in the title). A repeat with no date starts on the form's date, or
 * today. The title is the parse's, with the expressions out, unless that would leave it empty.
 */
export function parsedFormValues(
  values: TaskInput,
  touched: ReadonlySet<QuickSpanKind>,
  ctx: Omit<QuickParseContext, 'disabled'>,
): TaskInput {
  const parse = quickParse(values.title, { ...ctx, disabled: touched });
  const dueOn = parse.dueOn ?? values.dueOn;
  const recurrence = syncMonthly(parse.recurrence, dueOn) ?? values.recurrence;
  return {
    title: parse.spans.length === 0 ? values.title : parse.title,
    room: parse.room ?? values.room,
    assigneeId: parse.assigneeId ?? values.assigneeId,
    dueOn: recurrence !== null && dueOn === null ? ctx.today : dueOn,
    recurrence,
  };
}
