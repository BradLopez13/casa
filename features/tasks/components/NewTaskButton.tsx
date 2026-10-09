import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

/** Floating pill that opens the new-task form, pre-filling the assignee when one is chosen. */
export function NewTaskButton({
  testID,
  assigneeId,
}: {
  testID: string;
  assigneeId: string | null;
}) {
  const router = useRouter();
  const { colors, radii, space } = useTheme();
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
        right: space(4),
        bottom: space(4),
        minHeight: MIN_TOUCH,
        paddingHorizontal: space(5),
        justifyContent: 'center',
        borderRadius: radii.pill,
        backgroundColor: colors.cobalt,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.onCobalt, fontSize: 16, fontWeight: '600' }}
      >
        {`+ ${t('tasks.new')}`}
      </Text>
    </Pressable>
  );
}
