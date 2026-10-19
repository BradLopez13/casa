import { describe, expect, it } from 'vitest';

import { layoutFor } from './layout';
import { formDensity, modalFrameFor, SHEET_MAX_HEIGHT, sheetMargins } from './sheet';

const none = { top: 0, right: 0, bottom: 0, left: 0 };

describe('modalFrameFor', () => {
  it('keeps the full screen on a phone in portrait', () => {
    expect(modalFrameFor(layoutFor(390, 844))).toBe('full');
    expect(modalFrameFor(layoutFor(599, 900))).toBe('full');
  });

  it('draws a sheet from medium up', () => {
    expect(modalFrameFor(layoutFor(600, 900))).toBe('sheet');
    expect(modalFrameFor(layoutFor(844, 390))).toBe('sheet');
    expect(modalFrameFor(layoutFor(1024, 1366))).toBe('sheet');
    expect(modalFrameFor(layoutFor(1920, 1080))).toBe('sheet');
  });
});

describe('sheetMargins', () => {
  it('leaves 5 % above and below, so the sheet is at most 90 % high', () => {
    const m = sheetMargins(1000, 24, none);
    expect(m.top).toBe(50);
    expect(m.bottom).toBe(50);
    expect(1000 - m.top - m.bottom).toBe(1000 * SHEET_MAX_HEIGHT);
  });

  it('keeps the class gutter at the sides', () => {
    expect(sheetMargins(1000, 32, none)).toMatchObject({ left: 32, right: 32 });
  });

  it('gives way to deeper safe-area insets', () => {
    // A phone on its side: 18 dp would be 5 %, the status bar and the side notch are deeper.
    const m = sheetMargins(360, 24, { top: 28, right: 0, bottom: 16, left: 48 });
    expect(m).toEqual({ top: 28, right: 24, bottom: 18, left: 48 });
  });
});

describe('formDensity', () => {
  it('keeps the current spacing and the title autofocus on a tall window', () => {
    expect(formDensity(layoutFor(390, 844))).toEqual({
      headerStep: 2,
      topStep: 5,
      gapStep: 6,
      bottomStep: 8,
      autoFocusTitle: true,
      footRow: false,
    });
    expect(formDensity(layoutFor(1024, 1366)).autoFocusTitle).toBe(true);
  });

  it('closes up and leaves the keyboard down on a short window', () => {
    const tall = formDensity(layoutFor(390, 844));
    const short = formDensity(layoutFor(844, 390));
    expect(short.autoFocusTitle).toBe(false);
    expect(short.footRow).toBe(true);
    expect(short.headerStep).toBeLessThan(tall.headerStep);
    expect(short.topStep).toBeLessThan(tall.topStep);
    expect(short.gapStep).toBeLessThan(tall.gapStep);
    expect(short.bottomStep).toBeLessThan(tall.bottomStep);
  });
});
