import { Pressable, Text, View } from 'react-native';
import { t, type MessageKey } from '@/i18n';
import { useDoorCompact } from '@/ui/components/DoorHeader';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

export type TasksMode = 'week' | 'all';

const MODES: { value: TasksMode; label: MessageKey }[] = [
  { value: 'week', label: 'tasks.mode.week' },
  { value: 'all', label: 'tasks.mode.all' },
];

type Props = { value: TasksMode; onChange: (mode: TasksMode) => void };

/** "Semana · Todas": two pills, the chosen one filled with the selection colour. */
export function ModeSwitch({ value, onChange }: Props) {
  const { colors, radii, space } = useTheme();
  // In a compact door it shares the row with the people filter: closer pills, so the filter keeps
  // room for its magnets.
  const compact = useDoorCompact();
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
              paddingHorizontal: compact ? space(4) : space(5),
              justifyContent: 'center',
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.selection : 'transparent',
              borderWidth: 1.5,
              borderColor: selected ? colors.selection : colors.outline,
            }}
          >
            {/* Door text: it grows with the system's only up to the door's cap. */}
            <Text
              maxFontSizeMultiplier={DOOR_MAX_SCALE}
              style={{
                color: selected ? colors.onSelection : colors.ink,
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
