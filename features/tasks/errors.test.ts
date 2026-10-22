import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { taskErrorMessage } from './errors';

describe('taskErrorMessage', () => {
  it('maps known codes', () =>
    expect(taskErrorMessage(new AppError('TASK_NOT_FOUND'))).toBe(
      'Esta tarea ya no está: la habrán borrado desde otro móvil.',
    ));
  it('falls back to UNKNOWN for other codes and errors', () => {
    expect(taskErrorMessage(new AppError('NOT_OWNER'))).toBe(
      'No se pudo completar. Inténtalo de nuevo en un momento.',
    );
    expect(taskErrorMessage(new Error('x'))).toBe(
      'No se pudo completar. Inténtalo de nuevo en un momento.',
    );
  });
});
