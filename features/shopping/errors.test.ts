import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { shoppingErrorMessage } from './errors';

describe('shoppingErrorMessage', () => {
  it('maps known codes', () => {
    expect(shoppingErrorMessage(new AppError('ITEM_ALREADY_LISTED'))).toBe('Ya está en la lista.');
    expect(shoppingErrorMessage(new AppError('INVALID_ITEM_NAME'))).toBe(
      'Escribe un nombre de hasta 60 caracteres.',
    );
  });
  it('falls back to UNKNOWN for other codes and errors', () => {
    expect(shoppingErrorMessage(new AppError('NOT_OWNER'))).toBe(
      'Algo ha fallado. Inténtalo de nuevo.',
    );
    expect(shoppingErrorMessage(new Error('x'))).toBe('Algo ha fallado. Inténtalo de nuevo.');
  });
});
