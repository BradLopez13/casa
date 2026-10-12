import { describe, expect, it } from 'vitest';

import { settingsPanes, startsBlock } from './settingsPanes';

describe('settingsPanes', () => {
  it('keeps the usual order in one column', () => {
    expect(settingsPanes('stack')).toEqual({
      left: ['profile', 'members', 'reminders', 'notices', 'account'],
      right: [],
    });
  });

  it('puts the person and household left, the phone right, on two panes', () => {
    expect(settingsPanes('split')).toEqual({
      left: ['profile', 'members', 'account'],
      right: ['reminders', 'notices'],
    });
  });

  it('shows every group exactly once in either mode', () => {
    for (const mode of ['stack', 'split'] as const) {
      const { left, right } = settingsPanes(mode);
      expect([...left, ...right].sort()).toEqual(
        ['account', 'members', 'notices', 'profile', 'reminders'].sort(),
      );
    }
  });
});

describe('startsBlock', () => {
  it('spaces each section in one column as before', () => {
    const { left } = settingsPanes('stack');
    expect(left.map((_, i) => startsBlock(left, i))).toEqual([false, false, true, true, true]);
  });

  it('never spaces the first group of a pane', () => {
    const { left, right } = settingsPanes('split');
    expect(left.map((_, i) => startsBlock(left, i))).toEqual([false, false, true]);
    expect(right.map((_, i) => startsBlock(right, i))).toEqual([false, true]);
  });
});
