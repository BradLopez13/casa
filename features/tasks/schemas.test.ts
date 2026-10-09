import { describe, expect, it } from 'vitest';
import { taskFormSchema } from './schemas';

const base = { title: 'Fregar', room: null, assigneeId: null, dueOn: null, recurrence: null };
const parse = (over: Record<string, unknown>) => taskFormSchema.safeParse({ ...base, ...over });

describe('taskFormSchema', () => {
  it('trims the title', () => {
    const r = parse({ title: '  Fregar  ' });
    expect(r.success && r.data.title).toBe('Fregar');
  });

  it('rejects a blank title', () => {
    expect(parse({ title: '   ' }).success).toBe(false);
  });

  it('accepts 100 characters and rejects 101', () => {
    expect(parse({ title: 'a'.repeat(100) }).success).toBe(true);
    expect(parse({ title: 'a'.repeat(101) }).success).toBe(false);
  });

  it('counts code points like char_length, not UTF-16 units', () => {
    expect(parse({ title: '😀'.repeat(100) }).success).toBe(true);
    expect(parse({ title: '😀'.repeat(101) }).success).toBe(false);
  });

  it('rejects an unknown room', () => {
    expect(parse({ room: 'garage' }).success).toBe(false);
    expect(parse({ room: 'kitchen' }).success).toBe(true);
  });

  it('rejects a malformed dueOn', () => {
    expect(parse({ dueOn: '2026-1-5' }).success).toBe(false);
    expect(parse({ dueOn: '2026-10-05' }).success).toBe(true);
  });

  it('rejects a non-uuid assigneeId', () => {
    expect(parse({ assigneeId: 'nope' }).success).toBe(false);
    expect(parse({ assigneeId: '5b8f7f0e-3c1a-4e55-9a57-0d1f6f3a2b11' }).success).toBe(true);
  });

  it('accepts nulls for room, assigneeId and dueOn', () => {
    expect(parse({}).success).toBe(true);
  });
});

describe('taskFormSchema recurrence', () => {
  const rule = { kind: 'interval', every: 3 };

  it('rejects a rule without a date, flagging dueOn', () => {
    const r = parse({ recurrence: rule, dueOn: null });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'dueOn')).toBe(true);
  });

  it('accepts a rule with a date', () => {
    expect(parse({ recurrence: rule, dueOn: '2026-10-05' }).success).toBe(true);
  });

  it('rejects an invalid rule', () => {
    expect(parse({ recurrence: { kind: 'interval', every: 0 }, dueOn: '2026-10-05' }).success).toBe(
      false,
    );
  });
});
