import { Pressable, Text, View } from 'react-native';
import { ROOMS, type Room } from '@/domain/tasks/rooms';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Props = { value: Room | null; onChange: (room: Room | null) => void };

/** One pill per room, single choice; tapping the chosen room clears it. */
export function RoomPicker({ value, onChange }: Props) {
  const { colors, radii, space } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('taskForm.roomLabel')}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}
    >
      {ROOMS.map((room) => {
        const selected = room === value;
        return (
          <Pressable
            key={room}
            testID={`task-form.room.${room}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t(`rooms.${room}`)}
            onPress={() => onChange(selected ? null : room)}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH,
              paddingHorizontal: space(4),
              justifyContent: 'center',
              borderRadius: radii.pill,
              borderWidth: 2,
              borderColor: selected ? colors.cobalt : colors.outline,
              backgroundColor: selected ? colors.door : colors.note,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={{
                color: selected ? colors.cobalt : colors.ink,
                fontSize: 15,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {t(`rooms.${room}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
