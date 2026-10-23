import { describe, expect, it } from 'vitest';
import { sectionA11yLabel } from './sectionText';

describe('sectionA11yLabel', () => {
  it('reads one task in the singular', () => {
    expect(sectionA11yLabel('De días anteriores', 1)).toBe('De días anteriores, 1 tarea');
  });
  it('reads any other count in the plural', () => {
    expect(sectionA11yLabel('Hoy', 3)).toBe('Hoy, 3 tareas');
    expect(sectionA11yLabel('Hoy', 0)).toBe('Hoy, 0 tareas');
  });
});
