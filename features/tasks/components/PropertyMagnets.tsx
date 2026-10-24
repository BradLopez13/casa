import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { recurrenceLabel } from '@/domain/recurrence/label';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
import { dueChipLabel } from '@/domain/tasks/labels';
import type { Room } from '@/domain/tasks/rooms';
import { t } from '@/i18n';
import { buttonLook, pressedOpacity } from '@/ui/buttonLook';
import { Magnet } from '@/ui/components/Magnet';
import { glyphSize } from '@/ui/glyphSize';
import { useTheme } from '@/ui/theme';
import { magnetSizes } from '@/ui/tokens';
import type { FormField } from './formState';

type Props = {
  room: Room | null;
  assignee: { name: string; mark: MemberMark } | null;
  due: string | null;
  repeat: RecurrenceRule | null;
  today: string;
  /** The magnet whose picker is showing, drawn open. */
  open: FormField | null;
  onOpen: (field: FormField) => void;
  /** False on a completed or skipped occurrence: the repeat magnet shows its rule but waits. */
  repeatEditable: boolean;
  /** The open magnet's picker, drawn right under it. */
  picker?: ReactNode;
  /**
   * The open magnet and its picker as one block, measured on layout so the form scrolls the whole
   * of it into view: a tall picker never pushes its own magnet off the top.
   */
  openRef?: Ref<View>;
  onOpenLayout?: () => void;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One glyph per property, so each magnet says what it holds before its value is read. */
const GLYPHS: Record<FormField, IconName> = {
  room: 'home-outline',
  assignee: 'person-outline',
  due: 'calendar-outline',
  repeat: 'repeat-outline',
};
/** The open magnet's `ink` ring and the air between it and the disc. */
const OPEN_RING = 2.5;
// As the selection ring of a magnet: in dark the drawn drop (2 dp) never touches the ring.
const RING_GAP = 3;
/** A property line: the disc in its ring, and room for the two lines of text beside it. */
const PROPERTY_ROW = 52;

/**
 * A property magnet (fase 10f): the shape of the note's magnet, a disc with its glyph, and beside
 * it the field's name over its value; the whole line opens what changes it. With a value the disc
 * is the slate magnet (slate is what you chose); with none it is the bare ring, value muted. Open,
 * an `ink` ring goes round the disc, never `selection` (open is not chosen); its room is always
 * kept, so opening moves nothing. The chevron at the end says open or closed by shape, since in
 * dark `ink` and `selection` are the same chalk and the person's magnet in the picker below is
 * ringed as chosen. Shared by the task form (estancia, persona, fecha, repetición) and the product
 * sheet (cantidad).
 */
export function PropertyMagnet({
  testID,
  glyph,
  label,
  value,
  open,
  disabled = false,
  onPress,
  children,
  spoken,
  empty = false,
}: {
  testID: string;
  glyph: IconName;
  label: string;
  value: string;
  open: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** A magnet of its own in place of the glyph's (whoever does the task). */
  children?: ReactNode;
  /** Read instead of «label, value» when the value already says what it is. */
  spoken?: string;
  /** No value («Sin estancia», «—»): the bare ring, and the value in `muted`. */
  empty?: boolean;
}) {
  const { colors, space } = useTheme();
  const { fontScale } = useWindowDimensions();
  // A magnet that cannot open fades as a disabled control does: its `outline` ring stays whole and
  // only its glyph and words fade; dashed is paused, never this.
  const off = buttonLook('secondary', 'default', 'disabled', colors);
  const fade = { opacity: disabled ? off.labelOpacity : 1 };
  const bare = empty || disabled;
  const disc = children ?? (
    <Magnet
      testID={`${testID}.disc`}
      size="md"
      variant={bare ? 'empty' : 'filled'}
      decorative
      initial=""
      color="teal"
      accessibilityLabel=""
      glyph={{
        node: (
          <Ionicons
            name={glyph}
            size={Math.round(magnetSizes.md * 0.5)}
            color={disabled ? off.foreground : bare ? colors.muted : colors.onSelection}
            style={fade}
            accessible={false}
            importantForAccessibility="no"
          />
        ),
        fill: colors.selection,
      }}
    />
  );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      // A value that already names its field («No se repite») is read alone, not after it.
      accessibilityLabel={spoken ?? `${label}, ${value}`}
      aria-expanded={open}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: PROPERTY_ROW,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        opacity: pressedOpacity(pressed),
      })}
    >
      <View
        style={{
          padding: RING_GAP,
          borderWidth: OPEN_RING,
          borderRadius: (magnetSizes.md + 2 * (RING_GAP + OPEN_RING)) / 2,
          borderColor: open ? colors.ink : 'transparent',
        }}
      >
        {disc}
      </View>
      <View style={[{ flex: 1 }, fade]}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
        <Text
          style={{
            color: disabled ? off.foreground : empty ? colors.muted : colors.ink,
            fontSize: 17,
            // One weight open or closed, so opening does not change the text's width; an empty
            // value is lighter, as the example of an empty title.
            fontWeight: empty ? '400' : '500',
          }}
        >
          {value}
        </Text>
      </View>
      {disabled ? null : (
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={glyphSize(18, fontScale)}
          color={colors.muted}
          accessible={false}
          importantForAccessibility="no"
        />
      )}
    </Pressable>
  );
}

function Property({
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
  empty?: boolean;
}) {
  return (
    <PropertyMagnet
      testID={`task-form.prop.${field}`}
      glyph={GLYPHS[field]}
      onPress={() => onOpen(field)}
      {...rest}
    />
  );
}

/**
 * The property magnets under the title of the task form, one per line as magnets on a fridge
 * (fase 10f): each names its field over its current value («Estancia · Cocina», «Quién · Tú»,
 * «Cuándo · Hoy», «Repetir · No se repite») and opens that field's picker right under it, one at
 * a time. Whoever does it shows their magnet in place of the person glyph.
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
  picker,
  openRef,
  onOpenLayout,
}: Props) {
  // A repeat that cannot change never shows as open, even when Save points at it.
  const shown = open === 'repeat' && !repeatEditable ? null : open;
  /** A magnet, with its picker under it in one measured block when it is the open one. */
  const line = (field: FormField, magnet: ReactNode) =>
    shown === field ? (
      <View key={field} ref={openRef} onLayout={onOpenLayout}>
        {magnet}
        {picker}
      </View>
    ) : (
      <View key={field}>{magnet}</View>
    );
  return (
    <View>
      {line(
        'room',
        <Property
          field="room"
          label={t('taskForm.roomLabel')}
          value={room === null ? t('taskForm.noRoom') : t(`rooms.${room}`)}
          empty={room === null}
          open={shown === 'room'}
          onOpen={onOpen}
        />,
      )}
      {line(
        'assignee',
        <Property
          field="assignee"
          label={t('taskForm.assigneeLabel')}
          value={assignee === null ? t('taskForm.nobody') : assignee.name}
          empty={assignee === null}
          open={shown === 'assignee'}
          onOpen={onOpen}
        >
          {assignee !== null ? (
            <Magnet
              initial={assignee.mark.initial}
              color={assignee.mark.color}
              size="md"
              decorative
              accessibilityLabel={assignee.name}
            />
          ) : null}
        </Property>,
      )}
      {line(
        'due',
        <Property
          field="due"
          label={t('taskForm.dueLabel')}
          value={dueChipLabel(due, today)}
          empty={due === null}
          open={shown === 'due'}
          onOpen={onOpen}
        />,
      )}
      {line(
        'repeat',
        <Property
          field="repeat"
          label={t('taskForm.repeatField')}
          value={repeat === null ? t('taskForm.noRepeat') : recurrenceLabel(repeat)}
          spoken={repeat === null ? t('taskForm.noRepeat') : undefined}
          empty={repeat === null}
          open={shown === 'repeat'}
          disabled={!repeatEditable}
          onOpen={onOpen}
        />,
      )}
    </View>
  );
}
