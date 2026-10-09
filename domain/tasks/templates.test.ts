import { describe, expect, it } from 'vitest';
import { recurrenceRuleSchema } from '@/domain/recurrence/rule';
import { TEMPLATES, templateInputs } from './templates';

const today = '2026-10-09';

describe('templateInputs (today = Friday 2026-10-09)', () => {
  const inputs = templateInputs(['trash', 'fridge', 'dishes'], today);

  it('returns the chosen templates in TEMPLATES order, each due on its first date', () => {
    expect(inputs.map((i) => i.dueOn)).toEqual(['2026-10-09', '2026-10-12', '2026-11-01']);
    expect(inputs.map((i) => i.recurrence)).toEqual([
      { kind: 'interval', every: 1 },
      { kind: 'weekly', days: [1, 4] },
      { kind: 'monthly', day: 1 },
    ]);
    expect(inputs.map((i) => i.room)).toEqual(['kitchen', 'kitchen', 'kitchen']);
  });

  it('uses the translated titles', () => {
    expect(inputs.map((i) => i.title)).toEqual([
      'Fregar los platos',
      'Sacar la basura',
      'Limpiar la nevera',
    ]);
  });

  it('leaves every task unassigned', () => {
    expect(inputs.every((i) => i.assigneeId === null)).toBe(true);
  });

  it('returns nothing for no keys', () => {
    expect(templateInputs([], today)).toEqual([]);
  });

  it('only takes template keys', () => {
    // @ts-expect-error 'windows' is not a template key.
    expect(templateInputs(['windows'], today)).toEqual([]);
  });
});

describe('TEMPLATES', () => {
  it('has ten templates with valid rules', () => {
    expect(TEMPLATES).toHaveLength(10);
    for (const template of TEMPLATES) {
      expect(recurrenceRuleSchema.safeParse(template.rule).success).toBe(true);
    }
  });

  it('has unique keys', () => {
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
  });
});
