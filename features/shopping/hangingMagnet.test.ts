import { describe, expect, it } from 'vitest';
import { magnetSizes, MIN_TOUCH } from '@/ui/tokens';
import { hangingMagnet } from './hangingMagnet';

const ROW = MIN_TOUCH + 8;
const CHECK = magnetSizes.sm;

describe('hangingMagnet', () => {
  const { hang, firstRowInset } = hangingMagnet(magnetSizes.md, ROW, CHECK);

  it('puts the centre of the magnet on the top edge of the note', () => {
    expect(hang).toBe(magnetSizes.md / 2);
  });

  it('keeps the first checkbox clear of the magnet, with air that shows (fase 10a)', () => {
    const checkTop = firstRowInset + (ROW - CHECK) / 2;
    expect(checkTop).toBeGreaterThanOrEqual(magnetSizes.md / 2 + 10);
  });

  it('keeps the inset on the 4 dp grid', () => {
    expect(firstRowInset % 4).toBe(0);
  });
});
