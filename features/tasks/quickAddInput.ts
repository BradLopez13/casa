import { syncMonthly } from '@/domain/recurrence/form';
import type { TaskInput } from '@/domain/tasks/input';
import { quickParse, type QuickParseContext, type QuickSpanKind } from '@/domain/tasks/quick-parse';

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
  // A repeat with no date of its own starts on the given day, and a monthly one keeps that day.
  const due = parse.dueOn ?? dueOn;
  return {
    title: parse.title === '' ? raw : parse.title,
    room: parse.room,
    assigneeId: parse.assigneeId ?? assigneeId,
    dueOn: due,
    recurrence: syncMonthly(parse.recurrence, due),
  };
}

/** The parser's language, from the app's one locale. */
export function quickLocale(appLocale: string): QuickParseContext['locale'] {
  return appLocale.toLowerCase().startsWith('en') ? 'en' : 'es';
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
  /** False when the rule is not the person's to change: a chosen rule then keeps its day. */
  repeatEditable = true,
): TaskInput {
  const parse = quickParse(values.title, { ...ctx, disabled: touched });
  const dueOn = parse.dueOn ?? values.dueOn;
  // A monthly rule chosen by hand follows a date the title gives, as it follows a picked one.
  const chosen =
    parse.dueOn !== null && repeatEditable
      ? syncMonthly(values.recurrence, dueOn)
      : values.recurrence;
  const recurrence = syncMonthly(parse.recurrence, dueOn) ?? chosen;
  return {
    title: parse.spans.length === 0 ? values.title : parse.title,
    room: parse.room ?? values.room,
    assigneeId: parse.assigneeId ?? values.assigneeId,
    dueOn: recurrence !== null && dueOn === null ? ctx.today : dueOn,
    recurrence,
  };
}
