/** What `update_shopping_item` accepts. */
const MAX_LENGTH = 20;
const MAX_COUNT = 99;

// A whole number from 1 to 99 at the start, then anything that is not a decimal part.
const STEPPABLE = /^([1-9]\d?)(?![\d.,]\d|\d)(.*)$/s;

/**
 * The number a quantity starts with and the unit after it («2 kg» → 2, « kg»), or null when it
 * cannot go up and down: free text, a decimal, 0 or more than 99. No quantity reads as one.
 */
export function quantityStep(quantity: string | null): { count: number; unit: string } | null {
  if (quantity === null) return { count: 1, unit: '' };
  const match = STEPPABLE.exec(quantity);
  if (!match) return null;
  return { count: Number(match[1]), unit: match[2] ?? '' };
}

function stepped(quantity: string | null, delta: 1 | -1): string | null | undefined {
  const step = quantityStep(quantity);
  if (step === null) return undefined;
  const count = step.count + delta;
  if (count > MAX_COUNT) return undefined;
  // One with nothing after it is the same as no quantity; below one the quantity goes away.
  if (count < 1 || (count === 1 && step.unit === '')) {
    return quantity === null ? undefined : null;
  }
  const next = `${count}${step.unit}`;
  return next.length > MAX_LENGTH ? undefined : next;
}

/** Whether the quantity can move by one in that direction. */
export function canStep(quantity: string | null, delta: 1 | -1): boolean {
  return stepped(quantity, delta) !== undefined;
}

/** The quantity one up or one down, keeping its unit; unchanged when it cannot move. */
export function stepQuantity(quantity: string | null, delta: 1 | -1): string | null {
  const next = stepped(quantity, delta);
  return next === undefined ? quantity : next;
}
