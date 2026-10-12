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
              // The chosen room is filled, like every selected pill in the app: shape, not only colour.
              borderWidth: 1.5,
              borderColor: selected ? colors.cobalt : colors.outline,
              backgroundColor: selected ? colors.cobalt : colors.note,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? colors.onCobalt : colors.ink,
                fontSize: 15,
                // One weight in both states, so choosing never changes the pill's width.
                fontWeight: '600',
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
