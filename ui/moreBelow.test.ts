import { describe, expect, it } from 'vitest';
import { hasMoreBelow } from './moreBelow';

describe('hasMoreBelow', () => {
  it('says there is more while the content runs past the bottom edge', () => {
    expect(hasMoreBelow(600, 0, 300)).toBe(true);
    expect(hasMoreBelow(600, 200, 300)).toBe(true);
  });

  it('is quiet at the end, give or take a rounding pixel', () => {
    expect(hasMoreBelow(600, 300, 300)).toBe(false);
    expect(hasMoreBelow(600, 295, 300)).toBe(false);
  });

  it('is quiet when everything fits, or before the first layout', () => {
    expect(hasMoreBelow(200, 0, 300)).toBe(false);
    expect(hasMoreBelow(600, 0, 0)).toBe(false);
  });
});
