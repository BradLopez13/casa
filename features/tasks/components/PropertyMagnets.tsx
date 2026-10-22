import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { recurrenceLabel } from '@/domain/recurrence/label';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
import { dueChipLabel } from '@/domain/tasks/labels';
import type { Room } from '@/domain/tasks/rooms';
import { t } from '@/i18n';
import { buttonLook, pressedOpacity } from '@/ui/buttonLook';
import { glyphSize } from '@/ui/glyphSize';
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

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One glyph per property, so each magnet says what it holds before its value is read. */
const GLYPHS: Record<FormField, IconName> = {
  room: 'home-outline',
  assignee: 'person-outline',
  due: 'calendar-outline',
  repeat: 'repeat-outline',
};
const GLYPH_SIZE = 16;

/**
 * A property magnet: a pill with its glyph and its value, which opens what changes it. Shared by
 * the task form (estancia, persona, fecha, repetición) and the product sheet (cantidad).
 */
export function PropertyChip({
  testID,
  glyph,
  label,
  value,
  open,
  disabled = false,
  onPress,
  children,
  spoken,
  muted = false,
}: {
  testID: string;
  glyph: IconName;
  label: string;
  value: string;
  open: boolean;
  disabled?: boolean;
  onPress: () => void;
  children?: ReactNode;
  /** Read instead of «label, value» when the value already says what it is. */
  spoken?: string;
  /** The value is a placeholder («—»): drawn in `muted`, as an empty quantity pill. */
  muted?: boolean;
}) {
  const { colors, radii, space } = useTheme();
  // One selected style (§14.1): `selection` means chosen, so the open magnet is not filled with it; it
  // takes a heavier `ink` border on the note. A magnet that cannot open fades its label: dashed is paused.
  const off = buttonLook('secondary', 'default', 'disabled', colors);
  // The glyph grows with the label beside it.
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      // A value that already names its field («No se repite») is read alone, not after it.
      accessibilityLabel={spoken ?? `${label}, ${value}`}
      accessibilityState={{ expanded: open, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(2),
        // The open border is 1 dp thicker each side; the padding gives it back, so the pill keeps its width.
        paddingHorizontal: space(4) - (open ? 1 : 0),
        borderRadius: radii.pill,
        borderWidth: open ? 2.5 : 1.5,
        borderColor: disabled ? off.border : open ? colors.ink : colors.outline,
        backgroundColor: disabled ? off.fill : colors.note,
        opacity: pressedOpacity(pressed),
      })}
    >
      {children ?? (
        <Ionicons
          name={glyph}
          size={glyphSize(GLYPH_SIZE, fontScale)}
          color={disabled ? off.foreground : colors.muted}
          style={{ opacity: disabled ? off.labelOpacity : 1 }}
          accessible={false}
          importantForAccessibility="no"
        />
      )}
      <Text
        style={{
          color: disabled ? off.foreground : muted ? colors.muted : colors.ink,
          opacity: disabled ? off.labelOpacity : 1,
          fontSize: 15,
          // One weight in both states, so opening does not change the text's width.
          fontWeight: '600',
        }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function Chip({
  field,
  onOpen,
  ...rest
}: {
  field: FormField;
  label: string;
  value: string;
  open: boolean;
  disabled?: boolean;
  onOpen: (field: FormField) => void;
  children?: ReactNode;
  spoken?: string;
}) {
  return (
    <PropertyChip
      testID={`task-form.prop.${field}`}
      glyph={GLYPHS[field]}
      onPress={() => onOpen(field)}
      {...rest}
    />
  );
}

/**
 * The row of property magnets under the title of the task form: each shows its glyph and its
 * field's current value («Cocina», «Tú», «Hoy», «No se repite») and opens that field's picker,
 * one at a time. Whoever does it shows their magnet in place of the person glyph.
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
        value={dueChipLabel(due, today)}
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
