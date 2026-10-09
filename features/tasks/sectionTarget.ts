/** Where a strip day lives in the current list, or null when it has no section. */
export function sectionIndexFor(date: string, sections: readonly { key: string }[]): number | null {
  const index = sections.findIndex((section) => section.key === date);
  return index === -1 ? null : index;
}
