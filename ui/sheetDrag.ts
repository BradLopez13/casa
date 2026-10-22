// Pure: no react-native import, so Vitest can check it. Worklets: called from the gesture.

const MIN_DISTANCE = 120;
const FLICK_VELOCITY = 1000;

/** Whether letting go of a sheet dragged down by its header closes it (as «Cancelar» would). */
export function shouldDismiss({
  translationY,
  velocityY,
  height,
}: {
  translationY: number;
  velocityY: number;
  height: number;
}): boolean {
  'worklet';
  if (velocityY < 0) return false;
  if (velocityY >= FLICK_VELOCITY) return true;
  return translationY >= Math.max(MIN_DISTANCE, height / 4);
}

/** How far the sheet follows the finger: down only, and not at all with reduce motion. */
export function dragOffset(translationY: number, reduceMotion: boolean): number {
  'worklet';
  return reduceMotion ? 0 : Math.max(0, translationY);
}
