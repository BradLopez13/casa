/** Air between the bottom of the magnet and the first checkbox. */
const CLEARANCE = 4;
const GRID = 4;

/**
 * Where the magnet that holds the shopping note sits: its centre on the note's top edge, so half
 * of it hangs above (`hang`, the room kept over the note) and half lies on the paper. The first
 * row moves down by `firstRowInset` so its checkbox stays clear of that lower half.
 */
export function hangingMagnet(
  diameter: number,
  rowMinHeight: number,
  checkSize: number,
): { hang: number; firstRowInset: number } {
  const hang = diameter / 2;
  const needed = hang + CLEARANCE - (rowMinHeight - checkSize) / 2;
  const firstRowInset = Math.max(0, Math.ceil(needed / GRID) * GRID);
  return { hang, firstRowInset };
}
