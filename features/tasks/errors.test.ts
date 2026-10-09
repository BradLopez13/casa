import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { taskErrorMessage } from './errors';

describe('taskErrorMessage', () => {
  it('maps known codes', () =>
    expect(taskErrorMessage(new AppError('TASK_NOT_FOUND'))).toBe('Esta tarea ya no existe.'));
  it('falls back to UNKNOWN for other codes and errors', () => {
    expect(taskErrorMessage(new AppError('NOT_OWNER'))).toBe(
      'Algo ha fallado. Inténtalo de nuevo.',
    );
    expect(taskErrorMessage(new Error('x'))).toBe('Algo ha fallado. Inténtalo de nuevo.');
  });
});
