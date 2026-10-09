// Must match private.normalize_item_name in SQL character for character:
// the same translate() table, lower-casing, and the same pinned whitespace class
// (space, tab, LF, CR, FF, VT and NBSP only) for collapsing and trimming.
// Not \s or trim(): their sets differ between JS and Postgres (U+FEFF, U+0085, locale).
const FROM = 'áéíóúàèìòùäëïöüâêîôûñ';
const TO = 'aeiouaeiouaeiouaeioun';

const accents = new Map([...FROM].map((char, index) => [char, TO[index]]));

const runs = /[ \t\n\r\f\v\u00a0]+/g;
const edges = /^[ \t\n\r\f\v\u00a0]+|[ \t\n\r\f\v\u00a0]+$/g;

/** Trims with the pinned whitespace class, matching private.trim_item_text in SQL. */
export function trimItemText(text: string): string {
  return text.replace(edges, '');
}

export function normalizeItemName(name: string): string {
  return trimItemText(
    [...name.toLowerCase()]
      .map((char) => accents.get(char) ?? char)
      .join('')
      .replace(runs, ' '),
  );
}
