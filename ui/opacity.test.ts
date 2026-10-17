import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

// Files where an opacity other than a press, a glow or a show/hide is deliberate. One reason each.
const ALLOWED: Record<string, string> = {
  'features/tasks/components/TaskNote.tsx':
    'a task still on its way to the server is provisional (0.6)',
  'features/auth/social/AppleButton.tsx': "Apple's guidelines dictate the dimmed button (0.5)",
  'features/auth/social/AppleButton.ios.tsx': "Apple's guidelines dictate the dimmed button (0.5)",
};

// Opacity that is fine anywhere: press feedback, the faint check, animated glows (shared values),
// and the 0 / 1 literals used to hide or show.
const FINE = [
  /\bopacity:\s*(0|1|pressedOpacity\([^)]*\)|look\.opacity|[\w.]+\.value)\s*(?=[,}]|$)/g,
  /\bpressedOpacity\b/g,
];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

function offending(file: string): string[] {
  return readFileSync(join(ROOT, file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .map((line) => FINE.reduce((l, re) => l.replace(re, ''), line))
    .filter((line) => /opacity/i.test(line));
}

describe('opacity', () => {
  it('is never used to say a control is off, outside the allowlist', () => {
    const offenders = ['app', 'features', 'ui/components']
      .flatMap((d) => tsxFiles(join(ROOT, d)))
      .map((f) => relative(ROOT, f).split(sep).join('/'))
      .filter((f) => !(f in ALLOWED))
      .filter((f) => offending(f).length > 0);
    expect(offenders).toEqual([]);
  });
});
