import { Pressable, Text, View } from 'react-native';
import { offeredRooms } from '@/domain/tasks/catalog';
import type { Room } from '@/domain/tasks/rooms';
import { useMembership } from '@/features/households/queries';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Props = { value: Room | null; onChange: (room: Room | null) => void };

/**
 * One pill per room of the household, single choice; tapping the chosen room clears it. A room
 * the household dropped still shows while the task has it, so editing never loses it.
 */
export function RoomPicker({ value, onChange }: Props) {
  const { colors, radii, space } = useTheme();
  const rooms = offeredRooms(useMembership().data?.rooms, value);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('taskForm.roomLabel')}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}
    >
      {rooms.map((room) => {
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
              borderColor: selected ? colors.selection : colors.outline,
              backgroundColor: selected ? colors.selection : colors.note,
              opacity: pressedOpacity(pressed),
            })}
          >
            <Text
              style={{
                color: selected ? colors.onSelection : colors.ink,
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
