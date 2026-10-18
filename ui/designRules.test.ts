/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The rules of DESIGN.md («Reglas», spec §14) that a grep can check. A change that breaks one
 * does not merge: fix the code, or document the exception where the rule says how.
 */

const ROOT = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

const rel = (full: string) => path.relative(ROOT, full).split(path.sep).join('/');
const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), 'utf8');
const sources = ['app', 'features', 'ui/components'].flatMap((d) =>
  walk(path.join(ROOT, d)).map(rel),
);
const screens = sources.filter((f) => /^app\/(\(tabs\)|task)\/[^/]+\.tsx$/.test(f));
const tabs = sources.filter((f) => /^app\/\(tabs\)\/[^/_][^/]*\.tsx$/.test(f));

/** Every `file:line: text` in `files` whose line (and its neighbours) `offends`. */
function offenders(
  files: string[],
  offends: (line: string, lines: string[], i: number, constants: Map<string, number>) => boolean,
): string[] {
  return files.flatMap((file) => {
    const text = read(file);
    const constants = new Map<string, number>();
    for (const [, name, value] of text.matchAll(
      /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)\s*;/g,
    )) {
      if (name !== undefined) constants.set(name, Number(value));
    }
    const lines = text.split('\n');
    return lines.flatMap((line, i) =>
      offends(line, lines, i, constants) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
    );
  });
}

describe('design rules (DESIGN.md «Reglas»)', () => {
  // §14.2: radii come from `radii` (door 30, note 14, pill 999) or are circles (`size / 2`).
  it('no numeric radius literal outside circles and documented decorative pieces', () => {
    const found = offenders(sources, (line) => {
      const value = /\b\w*[rR]adius:\s*(\d+(?:\.\d+)?)/.exec(line)?.[1];
      if (value === undefined || Number(value) === 0) return false;
      if (/\/\s*2\b/.test(line)) return false;
      return !line.includes('// decorativo');
    });
    expect(found).toEqual([]);
  });

  // §14.4: the display face above 36 sp is only for the door's own headline and the
  // auth/onboarding title.
  it('no display font above 36 sp outside ScreenTitle and DoorHeader', () => {
    const allowed = ['ui/components/ScreenTitle.tsx', 'ui/components/DoorHeader.tsx'];
    const files = sources.filter((f) => !allowed.includes(f));
    const found = offenders(files, (line, lines, i, constants) => {
      const value = /fontSize:\s*([A-Z_][A-Z0-9_]*|\d+(?:\.\d+)?)\b/.exec(line)?.[1];
      if (value === undefined) return false;
      const size = /^\d/.test(value) ? Number(value) : (constants.get(value) ?? 0);
      if (size <= 36) return false;
      // The same style object, loosely: the display face within three lines either side.
      const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
      return /fontFamily:\s*displayFont\b(?!Bold)/.test(near);
    });
    expect(found).toEqual([]);
  });

  // §14.5: one pósit per screen.
  it('at most one primary button per screen', () => {
    const found = screens.filter((f) => (read(f).match(/variant="primary"/g) ?? []).length > 1);
    expect(found).toEqual([]);
  });

  // §2.4b, §14.4: the tabs share one door; the display titles stay on auth and onboarding.
  it('tabs use the door hierarchy, never a display title', () => {
    const found = tabs.filter((f) => /\bScreenTitle\b|\btitleSize=/.test(read(f)));
    expect(found).toEqual([]);
  });
});
