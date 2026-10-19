import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';

/** One quiet line above the first note, pointing at its box, until the first task is completed. */
export function CompleteHint() {
  const { colors, space } = useTheme();
  return (
    <Text
      testID="tasks.complete-hint"
      style={{ color: colors.muted, fontSize: 14, textAlign: 'right', paddingBottom: space(1.5) }}
    >
      {`${t('tasks.completeHint')} `}
      <Ionicons name="arrow-down" size={14} color={colors.muted} accessible={false} />
    </Text>
  );
}
