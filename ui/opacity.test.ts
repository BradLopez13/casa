import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

// The only places a literal opacity is allowed: a glow animation, the provisional note, the
// faint check, and the Apple button (its guidelines dictate the dimmed state).
const ALLOWED = new Set([
  'features/tasks/components/TaskNote.tsx',
  'features/shopping/components/ShoppingRow.tsx',
  'ui/components/FridgeRefresh.tsx',
  'features/auth/social/AppleButton.tsx',
  'features/auth/social/AppleButton.ios.tsx',
  'ui/components/Magnet.tsx',
]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('opacity', () => {
  it('is never used to say a control is off, outside the allowlist', () => {
    const offenders = ['features', 'ui/components']
      .flatMap((d) => tsxFiles(join(ROOT, d)))
      .map((f) => relative(ROOT, f).split(sep).join('/'))
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => /opacity:\s*0\./.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
