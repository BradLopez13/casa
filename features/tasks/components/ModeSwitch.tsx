import { Pressable, Text, View } from 'react-native';
import { t, type MessageKey } from '@/i18n';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

export type TasksMode = 'week' | 'all';

const MODES: { value: TasksMode; label: MessageKey }[] = [
  { value: 'week', label: 'tasks.mode.week' },
  { value: 'all', label: 'tasks.mode.all' },
];

type Props = { value: TasksMode; onChange: (mode: TasksMode) => void };

/** "Semana · Todas": two pills, the chosen one filled in cobalt. */
export function ModeSwitch({ value, onChange }: Props) {
  const { colors, radii, space } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space(2) }}>
      {MODES.map((mode) => {
        const selected = mode.value === value;
        return (
          <Pressable
            key={mode.value}
            testID={mode.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(mode.value)}
            style={{
              minHeight: MIN_TOUCH,
              paddingHorizontal: space(5),
              justifyContent: 'center',
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.cobalt : 'transparent',
              borderWidth: 1,
              borderColor: selected ? colors.cobalt : colors.outline,
            }}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={{
                color: selected ? colors.onCobalt : colors.ink,
                fontSize: 15,
                fontWeight: '600',
              }}
            >
              {t(mode.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
