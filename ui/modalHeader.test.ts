import { describe, expect, it } from 'vitest';
import { modalTitleInline } from './modalHeader';

// A phone in portrait: 412 wide, 16 dp padding each side, 8 dp between the three pieces.
const phone = { row: 380, gap: 8 };

describe('modalTitleInline', () => {
  it('keeps the title between the actions when it fits, centred', () => {
    // Default text: Cancelar 64, Guardar 92, Nueva tarea 104.
    expect(modalTitleInline({ ...phone, cancel: 64, save: 92, title: 104 })).toBe(true);
  });

  it('centres the title, so both sides reserve the wider action', () => {
    // 2 × 120 + 2 × 8 + 125 = 381: one dp too many.
    expect(modalTitleInline({ ...phone, cancel: 64, save: 120, title: 125 })).toBe(false);
    expect(modalTitleInline({ ...phone, cancel: 64, save: 120, title: 124 })).toBe(true);
  });

  it('moves the title under the actions at the largest text, where it would be cut', () => {
    // MIUI's largest text: Cancelar 93, Guardar 125, Nueva tarea 150.
    expect(modalTitleInline({ ...phone, cancel: 93, save: 125, title: 150 })).toBe(false);
  });

  it('keeps it inline in the wide sheet even with large text', () => {
    expect(modalTitleInline({ row: 526, gap: 8, cancel: 93, save: 125, title: 150 })).toBe(true);
  });

  it('stays inline until every piece has been measured', () => {
    expect(modalTitleInline({ ...phone, cancel: 0, save: 125, title: 150 })).toBe(true);
    expect(modalTitleInline({ row: 0, gap: 8, cancel: 93, save: 125, title: 150 })).toBe(true);
  });
});
