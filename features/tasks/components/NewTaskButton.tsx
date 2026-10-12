import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  newTaskListPadding,
  newTaskPlacement,
  newTaskShape,
} from '@/features/tasks/newTaskPlacement';
import { t } from '@/i18n';
import { space, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';

const PILL_HEIGHT = MIN_TOUCH + space(1);

/** The pill's offsets from the screen's right and bottom edges, clear of the safe areas. */
function usePlacement() {
  const insets = useSafeAreaInsets();
  const { rail } = useLayout();
  return newTaskPlacement({ insets, rail, edge: space(4) });
}

/** The labelled pill, or a round "+" on a short window (a phone on its side). */
function useShape() {
  const { shortHeight } = useLayout();
  return newTaskShape({ shortHeight, pillHeight: PILL_HEIGHT });
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
