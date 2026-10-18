import * as Haptics from 'expo-haptics';
import {
  FadeIn,
  FadeOut,
  LinearTransition,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

/**
 * Nido's one movement (spec §14.3): a single spring, a single set of vibrations, nothing longer
 * than 250 ms, and with Reduce Motion only 120 ms fades or instant changes.
 */
export const SPRING = { damping: 14, stiffness: 180 } as const;
export const FADE_MS = 120;
export const MAX_MS = 250;

/** A new note falls in leaning this many degrees, then straightens. */
const TILT_DEG = 1.5;
/** How far above its place a new note starts. */
const DROP_DP = 8;
/** A completed note lifts off the door to this scale as it leaves. */
const LIFT_SCALE = 1.02;

export type HapticKind = 'light' | 'rigid' | 'success';

/** `light` on a press, `rigid` when something is pinned, `success` when something is done. */
export async function haptic(kind: HapticKind): Promise<void> {
  try {
    if (kind === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.impactAsync(
        kind === 'rigid' ? Haptics.ImpactFeedbackStyle.Rigid : Haptics.ImpactFeedbackStyle.Light,
      );
    }
  } catch {
    // A device without a vibration motor is not an error.
  }
}

/** Which way a note leans as it arrives: fixed per id, so neighbours tend to differ. */
export function tiltFor(id: string): 1 | -1 {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return sum % 2 === 0 ? -1 : 1;
}

/** A note pinned to the door: it drops in tilted and straightens on the spring. */
export function enterAnimation(
  reduceMotion: boolean,
  tilt: 1 | -1 = 1,
): EntryExitAnimationFunction | ReturnType<typeof FadeIn.duration> {
  if (reduceMotion) return FadeIn.duration(FADE_MS);
  const from = `${tilt * TILT_DEG}deg`;
  return () => {
    'worklet';
    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateY: -DROP_DP }, { rotate: from }],
      },
      animations: {
        opacity: withTiming(1, { duration: FADE_MS }),
        transform: [{ translateY: withSpring(0, SPRING) }, { rotate: withSpring('0deg', SPRING) }],
      },
    };
  };
}

/** A note taken off the door: it lifts a little and fades as it goes. */
export function exitAnimation(
  reduceMotion: boolean,
): EntryExitAnimationFunction | ReturnType<typeof FadeOut.duration> {
  if (reduceMotion) return FadeOut.duration(FADE_MS);
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ scale: 1 }] },
      animations: {
        opacity: withTiming(0, { duration: MAX_MS }),
        transform: [{ scale: withTiming(LIFT_SCALE, { duration: MAX_MS }) }],
      },
    };
  };
}

/** Notes making room for each other; with Reduce Motion they just change places. */
export function layoutTransition(
  reduceMotion: boolean,
): ReturnType<typeof LinearTransition.duration> | undefined {
  return reduceMotion ? undefined : LinearTransition.duration(MAX_MS);
}
