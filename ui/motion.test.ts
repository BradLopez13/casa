import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
}));

// Reanimated cannot load outside a device; its builders are stood in by ones that record
// what motion.ts asks of them.
vi.mock('react-native-reanimated', () => {
  const builder = (name: string) => ({
    duration: (ms: number) => ({ name, durationV: ms }),
  });
  return {
    FadeIn: builder('FadeIn'),
    FadeOut: builder('FadeOut'),
    LinearTransition: builder('LinearTransition'),
    withSpring: (to: unknown, config: unknown) => ({ spring: to, config }),
    withTiming: (to: unknown, config: unknown) => ({ timing: to, config }),
  };
});

const Haptics = await import('expo-haptics');
const motion = await import('./motion');

describe('haptic', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps light to a light impact', async () => {
    await motion.haptic('light');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('maps rigid to a rigid impact', async () => {
    await motion.haptic('rigid');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Rigid);
  });

  it('maps success to a success notification', async () => {
    await motion.haptic('success');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('swallows a device without haptics', async () => {
    vi.mocked(Haptics.impactAsync).mockRejectedValueOnce(new Error('unavailable'));
    await expect(motion.haptic('light')).resolves.toBeUndefined();
  });
});

describe('motion values', () => {
  it('is one spring, one fade and one ceiling', () => {
    expect(motion.SPRING).toEqual({ damping: 14, stiffness: 180 });
    expect(motion.FADE_MS).toBe(120);
    expect(motion.MAX_MS).toBe(250);
  });
});

describe('enterAnimation', () => {
  it('is a 120 ms fade with Reduce Motion', () => {
    expect(motion.enterAnimation(true)).toEqual({ name: 'FadeIn', durationV: 120 });
  });

  it('drops in tilted 1.5° and settles straight on the spring', () => {
    const enter = motion.enterAnimation(false, -1) as unknown as () => {
      initialValues: { transform: Record<string, unknown>[] };
      animations: { transform: Record<string, unknown>[] };
    };
    const { initialValues, animations } = enter();
    expect(initialValues.transform).toContainEqual({ rotate: '-1.5deg' });
    expect(animations.transform).toContainEqual({
      rotate: { spring: '0deg', config: motion.SPRING },
    });
  });
});

describe('exitAnimation', () => {
  it('is a 120 ms fade with Reduce Motion', () => {
    expect(motion.exitAnimation(true)).toEqual({ name: 'FadeOut', durationV: 120 });
  });

  it('lifts the note to 1.02 and never runs past the ceiling', () => {
    const exit = motion.exitAnimation(false) as unknown as () => {
      animations: { opacity: { config: { duration: number } }; transform: unknown[] };
    };
    const { animations } = exit();
    expect(animations.transform).toContainEqual({
      scale: { timing: 1.02, config: { duration: motion.MAX_MS } },
    });
    expect(animations.opacity.config.duration).toBeLessThanOrEqual(motion.MAX_MS);
  });
});

describe('layoutTransition', () => {
  it('moves within the ceiling, and not at all with Reduce Motion', () => {
    expect(motion.layoutTransition(false)).toEqual({ name: 'LinearTransition', durationV: 250 });
    expect(motion.layoutTransition(true)).toBeUndefined();
  });
});

describe('tiltFor', () => {
  it('leans each note one way or the other, the same every time', () => {
    const tilts = ['a', 'b', 'c', 'd', 'e', 'f'].map(motion.tiltFor);
    expect(tilts.every((x) => x === 1 || x === -1)).toBe(true);
    expect(new Set(tilts).size).toBe(2);
    expect(motion.tiltFor('a')).toBe(motion.tiltFor('a'));
  });
});
