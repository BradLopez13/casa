import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { recurrenceLabel } from '@/domain/recurrence/label';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
import { dueLabel } from '@/domain/tasks/labels';
import type { Room } from '@/domain/tasks/rooms';
import { t } from '@/i18n';
import { buttonLook, pressedOpacity } from '@/ui/buttonLook';
import { Magnet } from '@/ui/components/Magnet';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import type { FormField } from './formState';

type Props = {
  room: Room | null;
  assignee: { name: string; mark: MemberMark } | null;
  due: string | null;
  repeat: RecurrenceRule | null;
  today: string;
  /** The magnet whose picker is showing, drawn selected. */
  open: FormField | null;
  onOpen: (field: FormField) => void;
  /** False on a completed or skipped occurrence: the repeat magnet shows its rule but waits. */
  repeatEditable: boolean;
};

function Chip({
  field,
  label,
  value,
  open,
  disabled = false,
  onOpen,
  children,
  spoken,
}: {
  field: FormField;
  label: string;
  value: string;
  open: boolean;
  disabled?: boolean;
  onOpen: (field: FormField) => void;
  children?: ReactNode;
  /** Read instead of «label, value» when the value already says what it is. */
  spoken?: string;
}) {
  const { colors, radii, space } = useTheme();
  // One selected style (§14.1): `selection` means chosen, so the open magnet is not filled with it; it
  // takes a heavier `ink` border on the note. A magnet that cannot open waits dashed, never faded.
  const off = buttonLook('secondary', 'default', 'disabled', colors);
  return (
    <Pressable
      testID={`task-form.prop.${field}`}
      accessibilityRole="button"
      // A value that already names its field («No se repite») is read alone, not after it.
      accessibilityLabel={spoken ?? `${label}, ${value}`}
      accessibilityState={{ expanded: open, disabled }}
      disabled={disabled}
      onPress={() => onOpen(field)}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(2),
        paddingHorizontal: space(4),
        borderRadius: radii.pill,
        borderWidth: open ? 2.5 : 1.5,
        borderStyle: disabled ? off.borderStyle : 'solid',
        borderColor: disabled ? off.border : open ? colors.ink : colors.outline,
        backgroundColor: disabled ? off.fill : colors.note,
        opacity: pressedOpacity(pressed),
      })}
    >
      {children}
      <Text
        style={{
          color: disabled ? off.foreground : colors.ink,
          fontSize: 15,
          // One weight in both states, so opening never changes the pill's width.
          fontWeight: '600',
        }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

/**
 * The row of property magnets under the title of the task form: each shows its field's current
 * value («Cocina», «Tú», «Hoy», «No se repite») and opens that field's picker, one at a time.
 */
export function PropertyMagnets({
  room,
  assignee,
  due,
  repeat,
  today,
  open,
  onOpen,
  repeatEditable,
}: Props) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      <Chip
        field="room"
        label={t('taskForm.roomLabel')}
        value={room === null ? t('taskForm.noRoom') : t(`rooms.${room}`)}
        open={open === 'room'}
        onOpen={onOpen}
      />
      <Chip
        field="assignee"
        label={t('taskForm.assigneeLabel')}
        value={assignee === null ? t('taskForm.nobody') : assignee.name}
        open={open === 'assignee'}
        onOpen={onOpen}
      >
        {assignee !== null ? (
          <Magnet
            initial={assignee.mark.initial}
            color={assignee.mark.color}
            size="sm"
            decorative
            accessibilityLabel={assignee.name}
          />
        ) : null}
      </Chip>
      <Chip
        field="due"
        label={t('taskForm.dueLabel')}
        value={dueLabel(due, today)}
        open={open === 'due'}
        onOpen={onOpen}
      />
      <Chip
        field="repeat"
        label={t('taskForm.repeatLabel')}
        value={repeat === null ? t('taskForm.noRepeat') : recurrenceLabel(repeat)}
        spoken={repeat === null ? t('taskForm.noRepeat') : undefined}
        open={open === 'repeat'}
        disabled={!repeatEditable}
        onOpen={onOpen}
      />
    </View>
  );
}
