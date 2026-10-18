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

describe('font scale caps', () => {
  it('maxFontSizeMultiplier only appears in allowed files', () => {
    const offenders = DIRS.flatMap((d) => walk(path.join(ROOT, d)))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter((rel) => readFileSync(path.join(ROOT, rel), 'utf8').includes('maxFontSizeMultiplier'))
      .filter((rel) => !ALLOWED.includes(rel));
    expect(offenders).toEqual([]);
  });
});
