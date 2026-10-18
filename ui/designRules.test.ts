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
      // A token nudged by a number (`radii.note + 4`) is a radius of its own too.
      const nudged = /\b\w*[rR]adius:\s*[^,]*[+-]\s*\d/.test(line);
      if (!nudged && (value === undefined || Number(value) === 0)) return false;
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
  // A `Button` with no `variant` is primary, so the count takes those too, plus `'primary'` inside
  // a `variant={…}` and any `buttonLook('primary'`. An arrow inside a prop (`onPress={() => …}`)
  // does not end the opening tag: `=>` is tried before any other character.
  const primaries = (text: string) => {
    const defaults = [...text.matchAll(/<Button\b(?:=>|[^>])*?\/?>/g)].filter(
      ([opening]) => !/\bvariant=/.test(opening),
    ).length;
    const literal = (text.match(/variant="primary"/g) ?? []).length;
    const ternary = (text.match(/variant=\{[^}]*'primary'[^}]*\}/g) ?? []).length;
    const looks = (text.match(/buttonLook\(\s*'primary'/g) ?? []).length;
    return defaults + literal + ternary + looks;
  };
  /**
   * Feature components that draw a pósit of their own: a screen that imports one has spent its
   * primary on it. One reason each.
   */
  const PRIMARY_COMPONENTS: Record<string, string> = {
    QuickAdd: 'its «+» is the pósit of Hoy and Tareas',
    AddItemField: 'its «+» is the pósit of the shopping list',
    TaskForm: 'its footer Save is the pósit of the task modals',
  };
  /** The PRIMARY_COMPONENTS a screen imports (each counts once, whatever the layouts). */
  const importedPrimaries = (text: string) => {
    const names = [...text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from/g)].flatMap(
      ([, list]) => (list ?? '').split(',').map((n) => n.trim().replace(/^type\s+/, '')),
    );
    return Object.keys(PRIMARY_COMPONENTS).filter((name) => names.includes(name));
  };
  const posits = (text: string) => primaries(text) + importedPrimaries(text).length;
  /** Screens with two primaries in the code that are never on screen together. */
  const NEVER_TOGETHER: Record<string, string> = {
    // «Invitar» turns secondary while the name is open, and «Guardar» only exists then.
    'app/(tabs)/settings.tsx': 'Invitar | Guardar el nombre',
  };

  it('at most one primary per screen, its feature components included', () => {
    const found = screens
      .filter((f) => posits(read(f)) > (NEVER_TOGETHER[f] ? 2 : 1))
      .map((f) => `${f}: ${primaries(read(f))} + [${importedPrimaries(read(f)).join(', ')}]`);
    expect(found).toEqual([]);
  });

  it('counts the default and conditional primaries', () => {
    expect(primaries('<Button title="a" />\n<Button title="b" variant="tertiary" />')).toBe(1);
    expect(primaries("<Button\n  title=\"a\"\n  variant={x ? 'secondary' : 'primary'}\n/>")).toBe(
      1,
    );
    expect(primaries('<Button title="a" />\n<Button title="b" variant="primary" />')).toBe(2);
    expect(primaries("buttonLook('primary', 'default', 'idle', colors)")).toBe(1);
    // The arrow in onPress does not cut the tag before its variant.
    expect(primaries('<Button onPress={() => go()} variant="secondary" />')).toBe(0);
    expect(primaries('<Button onPress={() => go()} title="a" />')).toBe(1);
  });

  it('counts the feature components that bring their own pósit', () => {
    const screen =
      "import { QuickAdd } from 'q';\nimport { Button } from 'b';\n<Button title=\"a\" />";
    expect(importedPrimaries(screen)).toEqual(['QuickAdd']);
    expect(posits(screen)).toBe(2);
    expect(importedPrimaries("import { TaskForm, type X } from 'f';")).toEqual(['TaskForm']);
  });

  // §2.4b, §14.4: the tabs share one door; the display titles stay on auth and onboarding.
  it('tabs use the door hierarchy, never a display title', () => {
    const found = tabs.filter((f) => /\bScreenTitle\b|\btitleSize=/.test(read(f)));
    expect(found).toEqual([]);
  });

  // «El símbolo aparece dentro de la app solo en el filtro Todos, en el final del día, en Tareas
  // vacía y en la puerta de Ajustes», besides the brand band, the fridge light and the fatal screen.
  it('the symbol only appears where DESIGN.md allows it', () => {
    const allowed = [
      'app/(tabs)/settings.tsx',
      'app/(tabs)/tasks.tsx',
      'features/tasks/components/DayDone.tsx',
      'features/tasks/components/MemberFilter.tsx',
      'ui/components/BrandHeader.tsx',
      'ui/components/FatalScreen.tsx',
      // The mono symbol inside the fridge light that pull-to-refresh reveals.
      'ui/components/FridgeRefresh.tsx',
      'ui/components/SymbolPlate.tsx',
    ];
    const found = sources.filter(
      (f) =>
        /['"][^'"]*\/(NidoSymbol|SymbolPlate)(\.tsx)?['"]/.test(read(f)) && !allowed.includes(f),
    );
    expect(found).toEqual([]);
  });
});
