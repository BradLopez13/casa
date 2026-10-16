import { describe, expect, it } from 'vitest';
import glyphs from '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';
import { actionIcons } from './actionIcons';

describe('actionIcons', () => {
  it('maps exactly the actions of the spec', () => {
    expect(Object.keys(actionIcons).sort()).toEqual(
      [
        'logIn',
        'signUp',
        'confirm',
        'sendCode',
        'changeEmail',
        'resend',
        'retry',
        'saveAndEnter',
        'home',
        'join',
        'invite',
        'copyLink',
        'makeOwner',
        'removeMember',
        'revoke',
        'signOut',
        'delete',
        'back',
        'close',
        'add',
        'openPhoneSettings',
      ].sort(),
    );
  });

  it.each(Object.entries(actionIcons))('%s uses a real Ionicons glyph (%s)', (_, glyph) => {
    expect(glyphs).toHaveProperty([glyph]);
  });
});
