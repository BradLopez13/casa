import { describe, expect, it } from 'vitest';
import { saveErrorText } from './taskFormText';

describe('saveErrorText', () => {
  it('asks for the title when it is empty', () => {
    expect(saveErrorText('INVALID_TITLE')).toBe('Escribe qué hay que hacer');
  });

  it('keeps the existing message for a repeat without a date', () => {
    expect(saveErrorText('RECURRENCE_NEEDS_DATE')).toBe('Una tarea que se repite necesita fecha.');
  });
});
