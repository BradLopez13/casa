import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  newTaskLane,
  newTaskListPadding,
  newTaskPlacement,
  newTaskShape,
} from '@/features/tasks/newTaskPlacement';
import { t } from '@/i18n';
import { columnRightOffset, columnRoom, paneColumn } from '@/ui/panes';
import { space, useTheme } from '@/ui/theme';
import { CONTROL_HEIGHT } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';

/**
 * The pill's offsets from the screen's right and bottom edges, clear of the safe areas. Beside
 * the rail (a wide window) it lines up with the right edge of the door's content column, the
 * frame the panes and Todas sit in, instead of the window's far edge.
 */
function usePlacement() {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { width } = useWindowDimensions();
  const anchor = layout.rail
    ? columnRightOffset(paneColumn(layout, insets, true), columnRoom(width, true, insets.left))
    : 0;
  return newTaskPlacement({ insets, rail: layout.rail, edge: space(4), anchor });
}

/** The labelled pill, or a round "+" on a short window (a phone on its side). */
function useShape() {
  const { shortHeight } = useLayout();
  return newTaskShape({ shortHeight, pillHeight: CONTROL_HEIGHT });
}

/** Room under the last note of a list that shows the button, so the button never covers it. */
export function useNewTaskListStyle() {
  const placement = usePlacement();
  const shape = useShape();
  return {
    paddingBottom: newTaskListPadding({
      placement,
      buttonHeight: shape.height,
      clearance: space(7),
    }),
  };
}

/**
 * How far from the right edge a list under the button keeps its content (`newTaskLane`): the
 * round "+" of a short window gets a lane of its own; the labelled pill, none.
 */
export function useNewTaskLane() {
  return newTaskLane({ placement: usePlacement(), shape: useShape(), gap: space(3) });
}

/** Floating button that opens the new-task form, pre-filling the assignee when one is chosen. */
export function NewTaskButton({
  testID,
  assigneeId,
}: {
  testID: string;
  assigneeId: string | null;
}) {
  const router = useRouter();
  const { colors, radii } = useTheme();
  const placement = usePlacement();
  const shape = useShape();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('tasks.new')}
      onPress={() =>
        router.push({
          pathname: '/task/new',
          params: assigneeId ? { assignee: assigneeId } : {},
        })
      }
      style={({ pressed }) => ({
        position: 'absolute',
        right: placement.right,
        bottom: placement.bottom,
        minHeight: shape.height,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(1),
        justifyContent: 'center',
        borderRadius: radii.pill,
        backgroundColor: colors.cobalt,
        opacity: pressed ? 0.85 : 1,
        ...(shape.iconOnly
          ? { width: shape.height, height: shape.height }
          : { paddingLeft: space(4), paddingRight: space(5) }),
      })}
    >
      <Ionicons
        name="add"
        size={shape.iconOnly ? 28 : 22}
        color={colors.onCobalt}
        accessible={false}
      />
      {shape.iconOnly ? null : (
        <Text
          maxFontSizeMultiplier={1.3}
          style={{ color: colors.onCobalt, fontSize: 16, fontWeight: '600' }}
        >
          {t('tasks.new')}
        </Text>
      )}
    </Pressable>
  );
}
