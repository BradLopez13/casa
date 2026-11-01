import { describe, expect, it } from 'vitest';

import { settingsPanes } from './settingsPanes';

describe('settingsPanes', () => {
  it('with several households, keeps «Tus casas» first in one column', () => {
    expect(settingsPanes('stack', true)).toEqual({
      left: ['households', 'members', 'reminders', 'notices', 'help', 'account'],
      right: [],
    });
  });

  // Bloque 13 (decisión 5, A): what is used (Miembros, Invitar) before «Tu casa».
  it('with one household, puts the members before «Tu casa»', () => {
    expect(settingsPanes('stack', false).left.slice(0, 2)).toEqual(['members', 'households']);
    expect(settingsPanes('split', false).left).toEqual(['members', 'households', 'account']);
  });

  it('puts the household and account left, the phone right, on two panes', () => {
    expect(settingsPanes('split', true)).toEqual({
      left: ['households', 'members', 'account'],
      right: ['reminders', 'notices', 'help'],
    });
  });

  it('shows every group exactly once in either mode', () => {
    for (const mode of ['stack', 'split'] as const) {
      const { left, right } = settingsPanes(mode, true);
      expect([...left, ...right].sort()).toEqual(
        ['account', 'help', 'households', 'members', 'notices', 'reminders'].sort(),
      );
    }
  });
});
