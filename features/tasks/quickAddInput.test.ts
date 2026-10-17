import { describe, expect, it } from 'vitest';
import {
  highlightRuns,
  parsedFormValues,
  quickAddInput,
  quickLocale,
  type QuickAddContext,
} from './quickAddInput';

const ctx: QuickAddContext = {
  today: '2026-10-17',
  members: [{ id: 'u2', name: 'Segundo' }],
  locale: 'es',
};

describe('quickAddInput', () => {
  it('builds a plain task for the given person and day', () => {
    expect(quickAddInput('Sacar la basura', 'u1', '2026-10-17', ctx)).toEqual({
      title: 'Sacar la basura',
      room: null,
      assigneeId: 'u1',
      dueOn: '2026-10-17',
      recurrence: null,
    });
  });

  it('trims the title', () => {
    expect(quickAddInput('  Regar  ', null, '2026-10-17', ctx)?.title).toBe('Regar');
  });

  it('is null for empty or blank text', () => {
    expect(quickAddInput('', 'u1', '2026-10-17', ctx)).toBeNull();
    expect(quickAddInput('   ', 'u1', '2026-10-17', ctx)).toBeNull();
  });

  it('takes a repeat out of the title and starts it on the given day', () => {
    expect(quickAddInput('Sacar la basura cada lunes', 'u1', '2026-10-20', ctx)).toEqual({
      title: 'Sacar la basura',
      room: null,
      assigneeId: 'u1',
      dueOn: '2026-10-20',
      recurrence: { kind: 'weekly', days: [1] },
    });
  });

  it('takes a date over the given day', () => {
    expect(quickAddInput('Regar mañana', 'u1', '2026-10-17', ctx)).toMatchObject({
      title: 'Regar',
      dueOn: '2026-10-18',
    });
  });

  it('takes a person and a room over the given ones', () => {
    expect(quickAddInput('Limpiar el baño para Segundo', 'u1', '2026-10-17', ctx)).toMatchObject({
      title: 'Limpiar',
      assigneeId: 'u2',
      room: 'bathroom',
    });
  });

  it('leaves a dismissed kind in the title', () => {
    expect(
      quickAddInput('Regar mañana', 'u1', '2026-10-17', { ...ctx, disabled: new Set(['due']) }),
    ).toMatchObject({ title: 'Regar mañana', dueOn: '2026-10-17' });
  });
});

describe('highlightRuns', () => {
  it('cuts the text into plain and recognised runs', () => {
    expect(
      highlightRuns('Regar mañana el baño', [
        { start: 6, end: 12, kind: 'due' },
        { start: 13, end: 20, kind: 'room' },
      ]),
    ).toEqual([
      { text: 'Regar ', kind: null },
      { text: 'mañana', kind: 'due' },
      { text: ' ', kind: null },
      { text: 'el baño', kind: 'room' },
    ]);
  });

  it('is one plain run without spans', () => {
    expect(highlightRuns('Regar', [])).toEqual([{ text: 'Regar', kind: null }]);
  });
});

describe('quickLocale', () => {
  it('reads the language from the app locale', () => {
    expect(quickLocale('es-ES')).toBe('es');
    expect(quickLocale('en-GB')).toBe('en');
  });
});

describe('parsedFormValues', () => {
  const form = {
    title: '',
    room: null,
    assigneeId: 'u1',
    dueOn: '2026-10-17',
    recurrence: null,
  };
  const none = new Set<never>();

  it('leaves a plain title and its values as they are', () => {
    const values = { ...form, title: 'Sacar  la basura ' };
    expect(parsedFormValues(values, none, ctx)).toEqual(values);
  });

  it('fills the fields the title names and takes the words out', () => {
    expect(
      parsedFormValues({ ...form, title: 'Limpiar el baño mañana para Segundo' }, none, ctx),
    ).toEqual({
      title: 'Limpiar',
      room: 'bathroom',
      assigneeId: 'u2',
      dueOn: '2026-10-18',
      recurrence: null,
    });
  });

  it('starts a repeat with no date on the form date, or today', () => {
    expect(
      parsedFormValues(
        { ...form, title: 'Sacar la basura cada lunes', dueOn: '2026-10-20' },
        none,
        ctx,
      ),
    ).toMatchObject({ dueOn: '2026-10-20', recurrence: { kind: 'weekly', days: [1] } });
    expect(
      parsedFormValues({ ...form, title: 'Sacar la basura cada lunes', dueOn: null }, none, ctx),
    ).toMatchObject({ dueOn: '2026-10-17', title: 'Sacar la basura' });
  });

  it('keeps a monthly repeat on the form date', () => {
    expect(
      parsedFormValues({ ...form, title: 'Pagar cada mes', dueOn: '2026-10-25' }, none, ctx)
        .recurrence,
    ).toEqual({ kind: 'monthly', day: 25 });
  });

  it('keeps a field chosen by hand and leaves its words in the title', () => {
    expect(
      parsedFormValues(
        { ...form, title: 'Regar mañana en la cocina', dueOn: '2026-10-25' },
        new Set(['due']),
        ctx,
      ),
    ).toMatchObject({ title: 'Regar mañana', dueOn: '2026-10-25', room: 'kitchen' });
  });

  it('keeps the title when the words would empty it', () => {
    expect(parsedFormValues({ ...form, title: 'mañana' }, none, ctx)).toMatchObject({
      title: 'mañana',
      dueOn: '2026-10-17',
    });
  });
});

describe('monthly repeats follow the date', () => {
  it('quick add keeps a monthly repeat on the given day', () => {
    expect(quickAddInput('Pagar cada mes', 'u1', '2026-10-25', ctx)).toMatchObject({
      title: 'Pagar',
      dueOn: '2026-10-25',
      recurrence: { kind: 'monthly', day: 25 },
    });
  });

  it('the form moves a chosen monthly rule to a date the title gives', () => {
    const values = {
      title: 'Pagar el 20',
      room: null,
      assigneeId: null,
      dueOn: '2026-10-25',
      recurrence: { kind: 'monthly' as const, day: 25 },
    };
    const repeat = new Set(['repeat' as const]);
    expect(parsedFormValues(values, repeat, ctx)).toMatchObject({
      dueOn: '2026-10-20',
      recurrence: { kind: 'monthly', day: 20 },
    });
    expect(parsedFormValues(values, repeat, ctx, false).recurrence).toEqual({
      kind: 'monthly',
      day: 25,
    });
  });
});
