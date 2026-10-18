import { describe, expect, it } from 'vitest';
import { dropSpan, quickParse, type QuickParseContext } from './quick-parse';

// 2026-10-17 is a Saturday.
const ctx: QuickParseContext = {
  today: '2026-10-17',
  members: [
    { id: 'm-segundo', name: 'Segundo' },
    { id: 'm-ana', name: 'Ana María' },
    { id: 'm-angel', name: 'Ángel' },
  ],
  locale: 'es',
};

const parse = (text: string, extra: Partial<QuickParseContext> = {}) =>
  quickParse(text, { ...ctx, ...extra });

describe('quickParse: dates', () => {
  it('reads «mañana» as tomorrow and removes it from the title', () => {
    const result = parse('Regar mañana');
    expect(result.title).toBe('Regar');
    expect(result.dueOn).toBe('2026-10-18');
  });

  it.each<[string, string]>([
    ['Barrer hoy', '2026-10-17'],
    ['Barrer pasado mañana', '2026-10-19'],
    ['Barrer para mañana', '2026-10-18'],
    ['Barrer MAÑANA', '2026-10-18'],
    ['Barrer manana', '2026-10-18'],
  ])('%s → %s', (text, due) => {
    const result = parse(text);
    expect(result.dueOn).toBe(due);
    expect(result.title).toBe('Barrer');
  });

  it('reads «el 23 de octubre» as this year when it is still ahead', () => {
    const result = parse('Llamar al fontanero el 23 de octubre');
    expect(result.title).toBe('Llamar al fontanero');
    expect(result.dueOn).toBe('2026-10-23');
  });

  it('moves a past «el 3 de octubre» to next year', () => {
    expect(parse('Pagar el 3 de octubre').dueOn).toBe('2027-10-03');
  });

  it('reads «el 23» as this month when it is still ahead', () => {
    expect(parse('Pagar el 23').dueOn).toBe('2026-10-23');
  });

  it('moves a past «el 5» to next month', () => {
    expect(parse('Pagar el 5').dueOn).toBe('2026-11-05');
  });

  it('skips months without that day for «el 31»', () => {
    expect(parse('Pagar el 31', { today: '2026-11-02' }).dueOn).toBe('2026-12-31');
  });

  it('ignores an impossible day', () => {
    const result = parse('Pagar el 32');
    expect(result.dueOn).toBeNull();
    expect(result.title).toBe('Pagar el 32');
  });

  it('reads «el lunes» as the next Monday', () => {
    expect(parse('Barrer el lunes').dueOn).toBe('2026-10-19');
  });

  it('reads «el sábado» as today when today is Saturday', () => {
    expect(parse('Barrer el sábado').dueOn).toBe('2026-10-17');
  });

  it('does not read «de mañana» as a date', () => {
    const result = parse('Comprar pan de mañana');
    expect(result.dueOn).toBeNull();
    expect(result.title).toBe('Comprar pan de mañana');
    expect(result.spans).toEqual([]);
  });

  it('does not apply a date that would leave the title empty', () => {
    const result = parse('mañana');
    expect(result.title).toBe('mañana');
    expect(result.dueOn).toBeNull();
    expect(result.spans).toEqual([]);
  });

  it('does not read a date word inside a longer word', () => {
    expect(parse('Revisar hoyos').dueOn).toBeNull();
  });
});

describe('quickParse: repetition', () => {
  it('reads «cada lunes» as weekly on Monday', () => {
    const result = parse('Sacar la basura cada lunes');
    expect(result.title).toBe('Sacar la basura');
    expect(result.recurrence).toEqual({ kind: 'weekly', days: [1] });
  });

  it('reads «cada lunes y jueves» as weekly on both days', () => {
    expect(parse('Regar cada jueves y lunes').recurrence).toEqual({
      kind: 'weekly',
      days: [1, 4],
    });
  });

  it('reads a comma list of weekdays', () => {
    expect(parse('Regar cada lunes, miércoles y viernes').recurrence).toEqual({
      kind: 'weekly',
      days: [1, 3, 5],
    });
  });

  it('reads «cada día» as every day', () => {
    const result = parse('Hacer la cama cada día');
    expect(result.title).toBe('Hacer la cama');
    expect(result.recurrence).toEqual({ kind: 'interval', every: 1 });
  });

  it('reads «cada 3 días» as an interval', () => {
    const result = parse('Regar las plantas cada 3 días');
    expect(result.title).toBe('Regar las plantas');
    expect(result.recurrence).toEqual({ kind: 'interval', every: 3 });
  });

  it('reads «cada mes» as monthly on today’s day', () => {
    expect(parse('Pagar el alquiler cada mes').recurrence).toEqual({ kind: 'monthly', day: 17 });
  });

  it('reads «cada mes» as monthly on the due day when there is one', () => {
    const result = parse('Pagar cada mes el 23');
    expect(result.dueOn).toBe('2026-10-23');
    expect(result.recurrence).toEqual({ kind: 'monthly', day: 23 });
    expect(result.title).toBe('Pagar');
  });

  it('reads «cada semana» as weekly on the due weekday', () => {
    expect(parse('Barrer cada semana el lunes').recurrence).toEqual({
      kind: 'weekly',
      days: [1],
    });
  });

  it('does not apply a repetition that would leave the title empty', () => {
    const result = parse('cada lunes');
    expect(result.title).toBe('cada lunes');
    expect(result.recurrence).toBeNull();
  });
});

describe('quickParse: assignee', () => {
  it('reads «para Segundo»', () => {
    const result = parse('Limpiar para Segundo');
    expect(result.title).toBe('Limpiar');
    expect(result.assigneeId).toBe('m-segundo');
  });

  it('reads «@Segundo» anywhere', () => {
    const result = parse('@Segundo limpiar');
    expect(result.title).toBe('limpiar');
    expect(result.assigneeId).toBe('m-segundo');
  });

  it('matches case and accent insensitively', () => {
    expect(parse('Limpiar para angel').assigneeId).toBe('m-angel');
  });

  it('accepts a unique prefix after «@»', () => {
    expect(parse('Limpiar @seg').assigneeId).toBe('m-segundo');
  });

  it('rejects an ambiguous prefix', () => {
    const result = parse('Limpiar @an');
    expect(result.assigneeId).toBeNull();
    expect(result.title).toBe('Limpiar @an');
  });

  it('takes a full two-word name', () => {
    const result = parse('Limpiar para Ana María');
    expect(result.assigneeId).toBe('m-ana');
    expect(result.title).toBe('Limpiar');
  });

  it('leaves «para» with an unknown name in the title', () => {
    const result = parse('Comprar regalo para Lucía');
    expect(result.assigneeId).toBeNull();
    expect(result.title).toBe('Comprar regalo para Lucía');
  });

  it('does not read an email address', () => {
    expect(parse('Escribir a seg@segundo.es').assigneeId).toBeNull();
  });

  it('gives members precedence over rooms', () => {
    const result = parse('Fregar para Cocina', {
      members: [{ id: 'm-cocina', name: 'Cocina' }],
    });
    expect(result.assigneeId).toBe('m-cocina');
    expect(result.room).toBeNull();
    expect(result.title).toBe('Fregar');
  });
});

describe('quickParse: room', () => {
  it('reads «en la cocina»', () => {
    const result = parse('Fregar en la cocina');
    expect(result.title).toBe('Fregar');
    expect(result.room).toBe('kitchen');
  });

  it('reads a bare room word at the end', () => {
    const result = parse('Limpiar baño');
    expect(result.title).toBe('Limpiar');
    expect(result.room).toBe('bathroom');
  });

  it('takes the article with a bare room word', () => {
    const result = parse('Limpiar el espejo del baño');
    expect(result.title).toBe('Limpiar el espejo');
    expect(result.room).toBe('bathroom');
  });

  it('ignores a bare room word in the middle', () => {
    const result = parse('Cocina saludable');
    expect(result.room).toBeNull();
  });

  it('reads a bare room word followed only by other expressions', () => {
    const result = parse('Limpiar baño mañana');
    expect(result.room).toBe('bathroom');
    expect(result.dueOn).toBe('2026-10-18');
    expect(result.title).toBe('Limpiar');
  });

  it.each<[string, string]>([
    ['Ordenar el salón', 'living_room'],
    ['Ordenar en la habitación', 'bedroom'],
    ['Ordenar dormitorio', 'bedroom'],
    ['Tender en el lavadero', 'laundry'],
    ['Barrer la terraza', 'outdoor'],
    ['Regar en el jardín', 'outdoor'],
  ])('%s → %s', (text, room) => {
    expect(parse(text).room).toBe(room);
  });

  it('does not read «otra» as a bare room', () => {
    expect(parse('Hacer otra').room).toBeNull();
  });

  it('does not apply a room that would leave the title empty', () => {
    const result = parse('baño');
    expect(result.room).toBeNull();
    expect(result.title).toBe('baño');
  });
});

describe('quickParse: review round 1', () => {
  const household = {
    members: [
      { id: 'm-elena', name: 'Elena' },
      { id: 'm-laura', name: 'Laura' },
      { id: 'm-miguel', name: 'Miguel' },
    ],
  };

  it.each([
    'Comprar pienso para el perro',
    'Hacer la compra para la cena',
    'Guardar sitio para mi',
  ])('«%s» has no assignee and keeps its title', (text) => {
    const result = parse(text, household);
    expect(result.assigneeId).toBeNull();
    expect(result.title).toBe(text);
  });

  it('needs the whole first word after «para»', () => {
    expect(parse('Limpiar para Seg').assigneeId).toBeNull();
    expect(parse('Limpiar para Ana').assigneeId).toBe('m-ana');
  });

  it('never reads a stopword after «@»', () => {
    expect(parse('Limpiar @el', household).assigneeId).toBeNull();
  });

  it.each(['Sacar al perro por la mañana', 'Llamó esta mañana', 'Pasear cada mañana'])(
    '«%s» has no date',
    (text) => {
      const result = parse(text);
      expect(result.dueOn).toBeNull();
      expect(result.title).toBe(text);
    },
  );

  it('finds a date after a match that started inside a word', () => {
    const result = parse('Prepara mañana el informe');
    expect(result.dueOn).toBe('2026-10-18');
    expect(result.title).toBe('Prepara el informe');
  });

  it('finds a room after a match that started inside a word', () => {
    const result = parse('Arregla cocina');
    expect(result.room).toBe('kitchen');
    expect(result.title).toBe('Arregla');
  });

  it.each(['Regar cada 0 días', 'Regar cada 400 días'])('rejects «%s»', (text) => {
    const result = parse(text);
    expect(result.recurrence).toBeNull();
    expect(result.title).toBe(text);
  });

  it('ignores «el 31 de febrero»', () => {
    const result = parse('Pagar el 31 de febrero');
    expect(result.dueOn).toBeNull();
    expect(result.title).toBe('Pagar el 31 de febrero');
  });

  it('reads no assignee without «para» or «@»', () => {
    const result = parse('Recoger a Ana mañana');
    expect(result.assigneeId).toBeNull();
    expect(result.dueOn).toBe('2026-10-18');
    expect(result.title).toBe('Recoger a Ana');
  });
});

describe('quickParse: spans', () => {
  it('points at the original text', () => {
    const text = 'Sacar la basura cada lunes para Segundo';
    const result = parse(text);
    expect(result.spans).toEqual([
      { start: 16, end: 26, kind: 'repeat' },
      { start: 27, end: 39, kind: 'assignee' },
    ]);
    expect(text.slice(16, 26)).toBe('cada lunes');
    expect(text.slice(27, 39)).toBe('para Segundo');
  });

  it('keeps indices across accented letters', () => {
    const text = 'Ñoño mañana';
    const [span] = parse(text).spans;
    expect(span && text.slice(span.start, span.end)).toBe('mañana');
  });
});

describe('dropSpan', () => {
  it('puts the word back in the title', () => {
    const text = 'Sacar la basura cada lunes';
    const dropped = dropSpan(parse(text), 'repeat', text, ctx);
    expect(dropped.title).toBe('Sacar la basura cada lunes');
    expect(dropped.recurrence).toBeNull();
    expect(dropped.spans).toEqual([]);
  });

  it('keeps the other expressions', () => {
    const text = 'Regar mañana en la cocina';
    const dropped = dropSpan(parse(text), 'room', text, ctx);
    expect(dropped.title).toBe('Regar en la cocina');
    expect(dropped.dueOn).toBe('2026-10-18');
    expect(dropped.room).toBeNull();
  });

  it('remembers earlier drops through ctx.disabled', () => {
    const text = 'Regar mañana en la cocina';
    const first = { ...ctx, disabled: new Set(['room'] as const) };
    const dropped = dropSpan(quickParse(text, first), 'due', text, first);
    expect(dropped.title).toBe('Regar mañana en la cocina');
  });
});

describe('quickParse: English', () => {
  const en = (text: string) => parse(text, { locale: 'en' });

  it('reads «every monday»', () => {
    const result = en('Take out the trash every monday');
    expect(result.title).toBe('Take out the trash');
    expect(result.recurrence).toEqual({ kind: 'weekly', days: [1] });
  });

  it('reads today and tomorrow', () => {
    expect(en('Water plants tomorrow').dueOn).toBe('2026-10-18');
    expect(en('Water plants today').dueOn).toBe('2026-10-17');
  });

  it('reads «every day», «for» and «in the kitchen»', () => {
    const result = en('Wipe counters every day for Segundo in the kitchen');
    expect(result.title).toBe('Wipe counters');
    expect(result.recurrence).toEqual({ kind: 'interval', every: 1 });
    expect(result.assigneeId).toBe('m-segundo');
    expect(result.room).toBe('kitchen');
  });
});

describe('quickParse: English, same coverage as Spanish', () => {
  const en = (text: string, extra: Partial<QuickParseContext> = {}) =>
    parse(text, { locale: 'en', ...extra });

  it.each<[string, string]>([
    ['Sweep today', '2026-10-17'],
    ['Sweep tomorrow', '2026-10-18'],
    ['Sweep the day after tomorrow', '2026-10-19'],
    ['Sweep day after tomorrow', '2026-10-19'],
    ['Sweep for tomorrow', '2026-10-18'],
    ['Sweep TOMORROW', '2026-10-18'],
  ])('%s → %s', (text, due) => {
    const result = en(text);
    expect(result.dueOn).toBe(due);
    expect(result.title).toBe('Sweep');
  });

  it('reads «on monday» as the next Monday', () => {
    const result = en('Sweep on monday');
    expect(result.dueOn).toBe('2026-10-19');
    expect(result.title).toBe('Sweep');
  });

  it('reads «on Saturday» as today when today is Saturday', () => {
    expect(en('Sweep on Saturday').dueOn).toBe('2026-10-17');
  });

  it.each<[string, string]>([
    ['Pay on the 23rd', '2026-10-23'],
    ['Pay on 23', '2026-10-23'],
    ['Pay on the 5th', '2026-11-05'],
    ['Call the plumber on october 23', '2026-10-23'],
    ['Call the plumber on the 23rd of october', '2026-10-23'],
    ['Call the plumber on 23 october', '2026-10-23'],
    ['Call the plumber October 23rd', '2026-10-23'],
    ['Pay on oct 3', '2027-10-03'],
  ])('%s → %s', (text, due) => {
    const result = en(text);
    expect(result.dueOn).toBe(due);
    expect(result.title).toBe(text.startsWith('Pay') ? 'Pay' : 'Call the plumber');
  });

  it('ignores «on february 31»', () => {
    const result = en('Pay on february 31');
    expect(result.dueOn).toBeNull();
    expect(result.title).toBe('Pay on february 31');
  });

  it.each([
    'Walk the dog in the morning',
    'Watch the world of tomorrow',
    "Make tomorrow's lunch",
    'Make tomorrow’s lunch',
    'Water every morning',
  ])('«%s» has no date', (text) => {
    const result = en(text);
    expect(result.dueOn).toBeNull();
    expect(result.title).toBe(text);
  });

  it('does not apply a date that would leave the title empty', () => {
    expect(en('tomorrow').title).toBe('tomorrow');
    expect(en('tomorrow').dueOn).toBeNull();
  });

  it('does not read a date word inside a longer word', () => {
    expect(en('Read todays paper').dueOn).toBeNull();
  });

  it.each<[string, { kind: string; every?: number; days?: number[]; day?: number }]>([
    ['Water every day', { kind: 'interval', every: 1 }],
    ['Water daily', { kind: 'interval', every: 1 }],
    ['Water every 3 days', { kind: 'interval', every: 3 }],
    ['Water every monday', { kind: 'weekly', days: [1] }],
    ['Water every thursday and monday', { kind: 'weekly', days: [1, 4] }],
    ['Water every monday, wednesday and friday', { kind: 'weekly', days: [1, 3, 5] }],
    ['Water every monday, wednesday, and friday', { kind: 'weekly', days: [1, 3, 5] }],
    ['Water every month', { kind: 'monthly', day: 17 }],
  ])('%s', (text, recurrence) => {
    const result = en(text);
    expect(result.title).toBe('Water');
    expect(result.recurrence).toEqual(recurrence);
  });

  it('reads «every month» on the due day when there is one', () => {
    const result = en('Pay every month on the 23rd');
    expect(result.dueOn).toBe('2026-10-23');
    expect(result.recurrence).toEqual({ kind: 'monthly', day: 23 });
    expect(result.title).toBe('Pay');
  });

  it('reads «every week» on the due weekday', () => {
    expect(en('Sweep every week on monday').recurrence).toEqual({ kind: 'weekly', days: [1] });
  });

  it.each(['Water every 0 days', 'Water every 400 days'])('rejects «%s»', (text) => {
    expect(en(text).recurrence).toBeNull();
  });

  it('reads «for Segundo» and «@seg»', () => {
    expect(en('Clean for Segundo').assigneeId).toBe('m-segundo');
    expect(en('Clean @seg').assigneeId).toBe('m-segundo');
    expect(en('Clean for Ana María').title).toBe('Clean');
  });

  it.each(['Buy food for the dog', 'Save a seat for me', 'Buy a gift for Lucy'])(
    '«%s» has no assignee and keeps its title',
    (text) => {
      const result = en(text);
      expect(result.assigneeId).toBeNull();
      expect(result.title).toBe(text);
    },
  );

  it.each<[string, string, string]>([
    ['Mop in the kitchen', 'kitchen', 'Mop'],
    ['Clean bathroom', 'bathroom', 'Clean'],
    ['Tidy the living room', 'living_room', 'Tidy'],
    ['Tidy in the bedroom', 'bedroom', 'Tidy'],
    ['Sweep the terrace', 'outdoor', 'Sweep'],
    ['Water in the garden', 'outdoor', 'Water'],
    ['Clean the mirror in the bathroom', 'bathroom', 'Clean the mirror'],
    ['Clean bathroom tomorrow', 'bathroom', 'Clean'],
  ])('%s → %s', (text, room, title) => {
    const result = en(text);
    expect(result.room).toBe(room);
    expect(result.title).toBe(title);
  });

  it.each(['Kitchen scales', 'Do the laundry', 'Clean the toilet', 'Do another'])(
    '«%s» has no room',
    (text) => {
      expect(en(text).room).toBeNull();
    },
  );
});
