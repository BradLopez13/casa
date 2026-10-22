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

  // §14.5: the active tab and the shopping note's magnet are chosen and chrome, not doing: slate.
  it('no magnet drawn in the pósit (the active tab and the shopping magnet are slate)', () => {
    const found = offenders(sources, (line) =>
      /glyph=\{\{[^}]*fill:\s*colors\.accent\b/.test(line),
    );
    const tints = offenders(
      ['features/navigation/FridgeTabBar.tsx', 'features/navigation/NavigationRail.tsx'],
      (line) => /focused\s*\?\s*colors\.onAccent\b/.test(line),
    );
    expect([...found, ...tints]).toEqual([]);
  });

  // «Una cabecera»: sheets and secondary screens share ModalHeader (a text action, the title in
  // one size) and keep their main action at the foot. ScreenTitle stays on auth and onboarding
  // (and the invitation, which phase 1 redraws).
  it('one header: no main action in ModalHeader, no display title outside auth', () => {
    const headed = offenders(sources, (line, lines, i) => {
      if (!/<ModalHeader\b/.test(line)) return false;
      const end = lines.findIndex((l, j) => j >= i && /\/>/.test(l));
      return /\baction=\{/.test(lines.slice(i, end + 1).join('\n'));
    });
    const titled = sources.filter(
      (f) =>
        /\bScreenTitle\b/.test(read(f)) &&
        !/^app\/\(auth\)\//.test(f) &&
        !['app/onboarding.tsx', 'app/invite.tsx', 'ui/components/ScreenTitle.tsx'].includes(f),
    );
    expect([...headed, ...titled]).toEqual([]);
  });

  // «Destructivo, en su medida»: a dialog never answers with the pósit. Confirming is secondary,
  // or the red primary when it destroys.
  it('the confirm dialog never draws the pósit', () => {
    const text = read('ui/components/ConfirmDialog.tsx');
    expect(text).not.toMatch(/variant="primary"/);
    expect(text).toMatch(/variant=\{content\.destructive \? 'primary' : 'secondary'\}/);
    expect(text).toMatch(/tone=\{content\.destructive \? 'destructive' : 'default'\}/);
  });

  // «Discontinuo es en pausa»: a dashed edge says paused (a switch the phone turned off), and
  // only the switch sets a border style. An unticked box or an unassigned magnet is a solid ring.
  const DASHED: Record<string, string> = {
    'ui/components/Toggle.tsx': 'a switch in pausa',
  };
  it('dashed only where it means paused', () => {
    const found = offenders(
      sources.filter((f) => !(f in DASHED)),
      (line) => /'dashed'|borderStyle:\s*\w/.test(line) && !/^\s*(\/\/|\*)/.test(line),
    );
    expect(found).toEqual([]);
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
      'features/settings/SettingsPieces.tsx',
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
  // Fase 1: the box at the right completes a task; the magnet only says whose it is.
  it('a task note completes with the box, never the magnet', () => {
    const note = read('features/tasks/components/TaskNote.tsx');
    expect(note).toContain('<CompleteBox');
    const magnet = note.slice(note.indexOf('<Magnet'), note.indexOf('/>', note.indexOf('<Magnet')));
    expect(magnet).toContain('decorative');
    expect(magnet).not.toMatch(/decorative=/);
    expect(magnet).not.toMatch(/onPress=/);
    expect(magnet).not.toMatch(/\bcheck=/);
  });

  // §36: the pósit's edge is a token of its own, so high contrast can turn it slate.
  it('the pósit edge is always accentEdge', () => {
    const accentBorder = /border(Color)?:\s*colors\.accent\b/;
    expect(offenders(sources, (line) => accentBorder.test(line))).toEqual([]);
    expect(read('ui/buttonLook.ts')).not.toMatch(accentBorder);
  });

  // §36: a pósit fill drawn by hand (not Button or Magnet) brings its edge along, or high
  // contrast leaves it at 1.4:1 on paper. The swipe strip under a note is the documented exception.
  it('a hand-drawn pósit fill also draws its edge', () => {
    const edged = /positEdge|look\.border|accentEdge/;
    const found = sources
      .filter((f) => !edged.test(read(f)))
      .flatMap((f) => {
        // `look.fill` is the pósit only where the look is a primary button's.
        const fill = read(f).includes("buttonLook('primary'")
          ? /backgroundColor:\s*(colors\.accent|look\.fill)\b/
          : /backgroundColor:\s*colors\.accent\b/;
        return offenders([f], (line) => fill.test(line) && !line.includes('// pósit sin borde'));
      });
    expect(found).toEqual([]);
  });

  // Discontinuo es en pausa (fase 2) and fase 9b: an unticked box is a bare ring, with no faint
  // check inside that reads as half ticked at large text.
  it('no faint check on an unticked box', () => {
    const found = offenders(sources, (line) => /check=\{[^}]*'faint'/.test(line));
    expect(found).toEqual([]);
  });

  // Pistas de primer uso (fase 9b): every hint line goes through FirstUseHint, so each one is
  // muted, said once to a screen reader and gone after its first use.
  it('hint texts are only drawn through FirstUseHint', () => {
    const hintKey =
      /t\('(?:tasks\.(?:completeHint|swipeHint\w*|quickHint\.\w+)|shopping\.quantityHint|refresh\.hint\w*)'\)/;
    const found = sources
      .filter((file) => !file.endsWith('.test.tsx') && hintKey.test(read(file)))
      .filter((file) => !read(file).includes('<FirstUseHint'));
    expect(found).toEqual([]);
  });

  // Cierre del contrato (fase 10a): every magnet that holds something says what; a slate disk with
  // nothing inside reads as a broken button.
  it('no magnet with an empty glyph', () => {
    expect(offenders(sources, (line) => /glyph=\{\{\s*node:\s*null/.test(line))).toEqual([]);
  });

  // Fase 10a: in every edit sheet Save waits dimmed until something changes.
  it('edit sheets keep Save dimmed until something changes', () => {
    expect(read('app/shopping/[id].tsx')).toMatch(/canSave = [^;]*\bdirty\b/);
    expect(read('features/tasks/components/TaskForm.tsx')).toMatch(/disabled=\{!isNew && !dirty\}/);
  });

  // Fase 10a: the quantity reads the same in the list and in the product sheet, with the scale
  // before its value, so «—» never looks like a «−».
  it('the quantity pill carries the scale of the product sheet', () => {
    expect(read('app/shopping/[id].tsx')).toMatch(/glyph="scale-outline"/);
    expect(read('features/shopping/components/QuantityPill.tsx')).toMatch(/name="scale-outline"/);
  });

  // Fase 10a: with the system's high contrast, in light, the door and the tab bar draw their
  // `outline` edge, since the enamel and the paper are 1.32:1.
  it('the door and the tab bar take an outline edge with high contrast', () => {
    expect(read('ui/components/DoorHeader.tsx')).toMatch(/doorEdge\(/);
    expect(read('features/navigation/FridgeTabBar.tsx')).toMatch(/doorEdge\(/);
  });

  // Movimiento and fase 10e: with Reducir movimiento everything turns to 120 ms fades or nothing,
  // so every entering/exiting animation is chosen through the flag (or the helpers that read it).
  it('every entering and exiting animation goes through Reducir movimiento', () => {
    const guarded = /reduceMotion|enterAnimation\(|exitAnimation\(/;
    const found = offenders(sources, (line, lines) => {
      const prop = /\b(?:entering|exiting)=\{([^}]*)\}/.exec(line)?.[1];
      if (prop === undefined || guarded.test(prop)) return false;
      // A named animation counts when its own definition reads the flag.
      const name = /^\s*(\w+)\s*$/.exec(prop)?.[1];
      const definition = name
        ? lines.find((l) => new RegExp(`const ${name}\\b`).test(l))
        : undefined;
      return definition === undefined || !guarded.test(definition);
    });
    expect(found).toEqual([]);
  });
});
