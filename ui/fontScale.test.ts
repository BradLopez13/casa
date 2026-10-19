/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['features', 'ui/components', 'app'];

// Only display titles, the nav rail, tab labels and the fixed-circle magnet may cap scaling.
const ALLOWED = [
  'ui/components/ScreenTitle.tsx',
  'ui/components/Magnet.tsx',
  'ui/components/FridgeRefresh.tsx',
  'features/navigation/NavigationRail.tsx',
  'features/navigation/FridgeTabBar.tsx',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

/** The door's own text may cap anywhere, but only at the door's cap. */
const DOOR_CAP = 'maxFontSizeMultiplier={DOOR_MAX_SCALE}';

/** Whether a file caps text other than at the door's cap. */
function capsOutsideDoor(source: string): boolean {
  return source.split(DOOR_CAP).join('').includes('maxFontSizeMultiplier');
}

describe('font scale caps', () => {
  it('maxFontSizeMultiplier only appears in allowed files, or at the door cap', () => {
    const offenders = DIRS.flatMap((d) => walk(path.join(ROOT, d)))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter((rel) => capsOutsideDoor(readFileSync(path.join(ROOT, rel), 'utf8')))
      .filter((rel) => !ALLOWED.includes(rel));
    expect(offenders).toEqual([]);
  });

  it('tells the door cap from any other', () => {
    expect(capsOutsideDoor('<Text maxFontSizeMultiplier={DOOR_MAX_SCALE}>')).toBe(false);
    expect(capsOutsideDoor('<Text maxFontSizeMultiplier={1.4}>')).toBe(true);
    expect(capsOutsideDoor('<Text>')).toBe(false);
  });

  it('caps the door’s eyebrow, headline and line', () => {
    const door = readFileSync(path.join(ROOT, 'ui/components/DoorHeader.tsx'), 'utf8');
    expect(door.split(DOOR_CAP).length - 1).toBeGreaterThanOrEqual(3);
  });
});
