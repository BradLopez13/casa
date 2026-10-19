/** A task title is one line: line breaks (from a paste) become a single space. */
export function oneLineTitle(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}
