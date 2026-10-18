import { describe, expect, it } from 'vitest';
import { completeBoxLook } from './completeBox';
import { contrastRatio } from './contrast';
import { palettes, type Scheme } from './tokens';

describe.each<Scheme>(['light', 'dark'])('completeBoxLook (%s)', (scheme) => {
  const p = palettes[scheme];

  it('draws an open task as an empty box with a solid edge', () => {
    expect(completeBoxLook(false, p)).toEqual({
      fill: 'transparent',
      border: p.selection,
      check: null,
    });
  });

  it('fills a done task with the pósit and its check', () => {
    expect(completeBoxLook(true, p)).toEqual({ fill: p.accent, border: p.accent, check: p.onAccent });
  });

  it('keeps the empty edge visible on the note (3:1)', () => {
    expect(contrastRatio(p.selection, p.taskNote)).toBeGreaterThanOrEqual(3);
  });

  it('keeps the check visible on the pósit (3:1)', () => {
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(3);
  });
});
