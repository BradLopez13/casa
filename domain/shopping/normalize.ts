// Must match private.normalize_item_name in SQL character for character:
// the same translate() table, lower-casing, trimming and whitespace collapse.
const FROM = 'áéíóúàèìòùäëïöüâêîôûñ';
const TO = 'aeiouaeiouaeiouaeioun';

const accents = new Map([...FROM].map((char, index) => [char, TO[index]]));

export function normalizeItemName(name: string): string {
  return [...name.toLowerCase()]
    .map((char) => accents.get(char) ?? char)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
