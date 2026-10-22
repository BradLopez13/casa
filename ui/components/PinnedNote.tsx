import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { useTheme } from '../theme';
import { magnetSizes, type MagnetSize } from '../tokens';
import { Magnet } from './Magnet';

type Glyph = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Android stacks by elevation before zIndex: above the note's, or a small magnet (flat) sinks. */
const MAGNET_LIFT = 8;

/** Who or what holds the note: a member's magnet (initial and colour) or a slate one with a glyph. */
export type Pin = { mark: MemberMark } | { glyph: string };

/**
 * A note held to the door by its magnet, the unit of every screen and not only the tabs (a
 * member, the account, a room of Plantillas, the product being edited). `side` 'left': the
 * magnet bites the left edge at the first line, as on a task. 'top': it hangs from the top edge,
 * its centre on the edge, as on the Compra. The magnet is decorative: what it says is read in the
 * note. The room it takes outside the note is kept by the frame, so nothing clips it.
 */
export function PinnedNote({
  pin,
  side,
  size = 'md',
  paper = 'note',
  testID,
  children,
}: {
  pin: Pin;
  side: 'left' | 'top';
  size?: MagnetSize;
  /** 'task': the soft pósit paper of a task note; 'note': the plain card. */
  paper?: 'note' | 'task';
  testID?: string;
  children: ReactNode;
}) {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  const diameter = magnetSizes[size];
  const hang = diameter / 2;
  const left = side === 'left';
  const magnet =
    'mark' in pin ? (
      <Magnet
        size={size}
        decorative
        initial={pin.mark.initial}
        color={pin.mark.color}
        accessibilityLabel=""
      />
    ) : (
      <Magnet
        size={size}
        decorative
        initial=""
        color="teal"
        accessibilityLabel=""
        glyph={{
          node: (
            <MaterialCommunityIcons
              name={pin.glyph as Glyph}
              size={Math.round(diameter * 0.5)}
              color={colors.onSelection}
              accessible={false}
              importantForAccessibility="no"
            />
          ),
          fill: colors.selection,
        }}
      />
    );
  return (
    <View testID={testID} style={left ? { paddingLeft: hang } : { paddingTop: hang }}>
      <View
        style={{
          gap: space(3),
          padding: space(4),
          // Clear of the half of the magnet that lies on the paper.
          ...(left ? { paddingLeft: hang + space(3) } : { paddingTop: hang + space(2) }),
          backgroundColor: paper === 'task' ? colors.taskNote : colors.note,
          borderRadius: radii.note,
          ...shadows.note,
          ...noteEdge,
        }}
      >
        {children}
      </View>
      <View
        pointerEvents="none"
        style={
          left
            ? { position: 'absolute', left: 0, top: space(4), zIndex: 1, elevation: MAGNET_LIFT }
            : {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 1,
                elevation: MAGNET_LIFT,
              }
        }
      >
        {magnet}
      </View>
    </View>
  );
}
