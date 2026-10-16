/** Seconds left before a new code may be requested; 0 once the cooldown has passed. */
export function secondsLeft(sentAt: number, now: number, cooldown = 60): number {
  return Math.max(0, Math.ceil(cooldown - (now - sentAt) / 1000));
}
