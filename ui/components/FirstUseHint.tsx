import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, type ReactNode } from 'react';
import { Text } from 'react-native';
import { announce, useScreenReader } from '../a11y';
import { DOOR_MAX_SCALE } from '../door';
import { useTheme } from '../theme';

// Each hint is said once per run of the app, however often (and wherever) it is drawn again.
const announced = new Set<string>();

type Props = {
  testID: string;
  /** The line; a node can underline the words it teaches (the quick add's example). */
  text: ReactNode;
  /** What a screen reader gets instead, when the gesture does not apply to it (swipe, pull). */
  readerText?: string;
  /** Points at what it teaches; drawn after the text. */
  arrow?: 'arrow-down' | 'arrow-up' | 'arrow-forward';
  align?: 'left' | 'right' | 'center';
  /** In or right under the door: it takes the door's text cap. */
  door?: boolean;
  /**
   * A cap on its lines, ending in «…» past it: a narrow compact door would otherwise clip the
   * second line half way (fase 10a).
   */
  numberOfLines?: number;
};

/**
 * A first-use hint (DESIGN.md «Pistas de primer uso»): one quiet muted line beside the thing it
 * teaches, shown until that thing is first used on this device (`features/hints`). With a screen
 * reader it is announced once, as it appears.
 */
export function FirstUseHint({
  testID,
  text,
  readerText,
  arrow,
  align = 'left',
  door = false,
  numberOfLines,
}: Props) {
  const { colors } = useTheme();
  const reader = useScreenReader();
  const said = reader && readerText !== undefined ? readerText : text;
  const spoken = typeof said === 'string' ? said : null;

  useEffect(() => {
    // By what it says: the same hint on Hoy and on Tareas is one hint.
    if (!reader || spoken === null || announced.has(spoken)) return;
    announced.add(spoken);
    announce(spoken);
  }, [reader, spoken]);

  const style = { color: colors.muted, fontSize: 14, textAlign: align } as const;
  const line = (
    <>
      {said}
      {arrow && said === text ? (
        <>
          {' '}
          <Ionicons name={arrow} size={14} color={colors.muted} accessible={false} />
        </>
      ) : null}
    </>
  );
  return door ? (
    <Text
      testID={testID}
      maxFontSizeMultiplier={DOOR_MAX_SCALE}
      numberOfLines={numberOfLines}
      style={style}
    >
      {line}
    </Text>
  ) : (
    <Text testID={testID} numberOfLines={numberOfLines} style={style}>
      {line}
    </Text>
  );
}
