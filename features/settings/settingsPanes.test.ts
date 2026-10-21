import { describe, expect, it } from 'vitest';

import { settingsPanes } from './settingsPanes';

describe('settingsPanes', () => {
  it('keeps the usual order in one column', () => {
    expect(settingsPanes('stack')).toEqual({
      left: ['members', 'reminders', 'notices', 'help', 'account'],
      right: [],
    });
  });

  it('puts the household and account left, the phone right, on two panes', () => {
    expect(settingsPanes('split')).toEqual({
      left: ['members', 'account'],
      right: ['reminders', 'notices', 'help'],
    });
  });

  it('shows every group exactly once in either mode', () => {
    for (const mode of ['stack', 'split'] as const) {
      const { left, right } = settingsPanes(mode);
      expect([...left, ...right].sort()).toEqual(
        ['account', 'help', 'members', 'notices', 'reminders'].sort(),
      );
    }
  });
});
