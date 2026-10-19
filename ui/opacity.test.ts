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
  'ui/magnetCheck.ts':
    "the faint check on an open magnet (0.4) is the magnet's drawing, not a control turned off",
};

// Opacity that is fine anywhere: press feedback, the faint check, animated glows (shared values),
// the 0 / 1 literals used to hide or show, fades between them, a type annotation, and the faded
// label of a disabled control, which only `buttonLook` decides (`labelOpacity`).
const FINE = [
  /\bopacity:\s*(?:\w+\s*\?\s*)?(?:[\w.]+\.)?labelOpacity\b(?:\s*:\s*1)?/g,
  /\bopacity:\s*(0|1|number|pressedOpacity\([^)]*\)|look\.opacity|[\w.]+\.value|withTiming\(\s*[01]\s*,[^)]*\))\s*(?=[,;}]|$)/g,
  /\bpressedOpacity\b/g,
];

// Only an opacity actually set: a style key or a prop. Not `shadowOpacity`, not identifiers.
const SETS_OPACITY = /\bopacity\s*:|\bopacity=\{/;

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, ext);
    return ext.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

function offendingLines(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .map((line) => FINE.reduce((l, re) => l.replace(re, ''), line))
    .filter((line) => SETS_OPACITY.test(line));
}

describe('opacity', () => {
  it('says a control is off only through buttonLook, outside the allowlist', () => {
    const offenders = [
      ...['app', 'features', 'ui/components'].flatMap((d) => files(join(ROOT, d), /\.tsx$/)),
      // The look helpers under ui/ set opacity in plain .ts too.
      ...files(join(ROOT, 'ui'), /\.ts$/),
    ]
      .map((f) => relative(ROOT, f).split(sep).join('/'))
      .filter((f) => !(f in ALLOWED))
      .filter((f) => offendingLines(readFileSync(join(ROOT, f), 'utf8')).length > 0);
    expect(offenders).toEqual([]);
  });

  it('looks only at opacity being set', () => {
    expect(offendingLines('shadowOpacity: 0.2,')).toEqual([]);
    expect(offendingLines('const PROVISIONAL_OPACITY = 0.6;')).toEqual([]);
    expect(offendingLines('opacity: pressedOpacity(pressed),')).toEqual([]);
    expect(offendingLines('opacity: withTiming(0, { duration: MAX_MS }),')).toEqual([]);
    expect(offendingLines('opacity: disabled ? 0.4 : 1,')).toHaveLength(1);
    expect(offendingLines('opacity: disabled ? off.labelOpacity : 1,')).toEqual([]);
    expect(offendingLines('opacity: look.labelOpacity,')).toEqual([]);
    expect(offendingLines('<View opacity={0.5} />')).toHaveLength(1);
  });
});
