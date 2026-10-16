import { describe, expect, it } from 'vitest';
import { passwordToggle } from './passwordToggle';

describe('passwordToggle', () => {
  it('offers to show the password while it is hidden', () => {
    expect(passwordToggle(false)).toEqual({ icon: 'eye-outline', labelKey: 'auth.password.show' });
  });
  it('offers to hide the password while it is visible', () => {
    expect(passwordToggle(true)).toEqual({
      icon: 'eye-off-outline',
      labelKey: 'auth.password.hide',
    });
  });
});
