import { describe, expect, it } from 'vitest';

import { revealOffset } from './reveal';

const base = { viewportTop: 100, viewportHeight: 300, offset: 40, margin: 16, fieldHeight: 50 };

describe('revealOffset', () => {
  it('leaves a field that is already in view', () => {
    expect(revealOffset({ ...base, fieldTop: 200 })).toBeNull();
    // Exactly at the margins on both sides.
    expect(revealOffset({ ...base, fieldTop: 116 })).toBeNull();
    expect(revealOffset({ ...base, fieldTop: 334 })).toBeNull();
  });

  it('scrolls down until a field hidden below sits above the bottom margin', () => {
    // The field spans 300..350 inside the viewport; it must end at 284.
    expect(revealOffset({ ...base, fieldTop: 400 })).toBe(40 + 66);
  });

  it('scrolls up until a field hidden above sits below the top margin', () => {
    // The field starts at -20 inside the viewport; it must start at 16.
    expect(revealOffset({ ...base, fieldTop: 80 })).toBe(4);
  });

  it('never scrolls above the start', () => {
    expect(revealOffset({ ...base, offset: 10, fieldTop: 50 })).toBe(0);
  });

  it('shows the top of a field taller than the visible area', () => {
    expect(revealOffset({ ...base, fieldHeight: 400, fieldTop: 250 })).toBe(40 + 150 - 16);
  });
});
