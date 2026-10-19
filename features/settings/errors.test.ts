import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { t } from '@/i18n';
import { settingsErrorMessage } from './errors';

describe('settingsErrorMessage', () => {
  it('maps an invalid name, the network and anything else', () => {
    expect(settingsErrorMessage(new AppError('INVALID_DISPLAY_NAME'))).toBe(
      t('errors.INVALID_DISPLAY_NAME'),
    );
    expect(settingsErrorMessage(new AppError('NETWORK'))).toBe(t('members.errors.NETWORK'));
    expect(settingsErrorMessage(new AppError('NOT_OWNER'))).toBe(t('members.errors.UNKNOWN'));
    expect(settingsErrorMessage(new Error('x'))).toBe(t('members.errors.UNKNOWN'));
  });
});
