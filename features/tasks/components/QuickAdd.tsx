import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { syncMonthly } from '@/domain/recurrence/form';
import { recurrenceLabel } from '@/domain/recurrence/label';
import { dueLabel } from '@/domain/tasks/labels';
import {
  dropSpan,
  quickParse,
  type QuickParse,
  type QuickSpanKind,
} from '@/domain/tasks/quick-parse';
import { useMembers } from '@/features/households/queries';
import { locale, t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { buttonLook, buttonMetrics, pressedOpacity } from '@/ui/buttonLook';
import { useNotice } from '@/ui/components/Notice';
import { haptic } from '@/ui/motion';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { createTask, newTaskId } from '../api';
import { taskErrorMessage } from '../errors';
import { highlightRuns, quickAddInput, quickLocale, type QuickAddContext } from '../quickAddInput';
import { useTaskMutation } from '../queries';
import { useToday } from '../useToday';

const ADD_SIZE = 40;
const CHIP_HEIGHT = 32;
// Off until the overlay is checked on a device (the chips alone meet the spec); set to true to
// draw the recognised words highlighted in the field again.
const INLINE_HIGHLIGHT = false;

const KIND_ICONS = {
  due: 'calendar-outline',
  repeat: 'repeat',
  assignee: 'person-outline',
  room: 'home-outline',
} as const satisfies Record<QuickSpanKind, keyof typeof Ionicons.glyphMap>;

type Props = {
  householdId: string | undefined;
  assigneeId: string | null;
  dueOn: string;
  placeholder: string;
  testID: string;
};

/** What a recognised part says on its chip: the date, the repeat, the person or the room. */
function chipLabel(
  kind: QuickSpanKind,
  parse: QuickParse,
  ctx: QuickAddContext,
  dueOn: string,
): string {
  switch (kind) {
    case 'due':
      return dueLabel(parse.dueOn, ctx.today);
    case 'repeat': {
      // The rule as it will be saved: a monthly one keeps the day it starts on.
      const rule = syncMonthly(parse.recurrence, parse.dueOn ?? dueOn);
      return rule === null ? '' : recurrenceLabel(rule);
    }
    case 'assignee':
      return ctx.members.find((m) => m.id === parse.assigneeId)?.name ?? '';
    case 'room':
      return parse.room === null ? '' : t(`rooms.${parse.room}`);
  }
}

/**
 * One line to jot a task down: type a title and send it. Dates, repeats, people and rooms written
 * in it are picked out as it is typed, highlighted in the text and shown as chips below; tapping a
 * chip leaves those words in the title. Anything not written lands on the given day for the given
 * person, and the field stays ready for the next one.
 */
export function QuickAdd({ householdId, assigneeId, dueOn, placeholder, testID }: Props) {
  const { colors, radii, space } = useTheme();
  const notify = useNotice();
  const today = useToday();
  const { data: memberRows } = useMembers(householdId);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  // Kinds dismissed for the text being typed; forgotten when the field empties.
  const [disabled, setDisabled] = useState<ReadonlySet<QuickSpanKind>>(() => new Set());
  // The highlight is drawn under a transparent input. Once the text no longer fits on the line the
  // input scrolls and the drawing could not follow, so the plain text comes back.
  const [fieldWidth, setFieldWidth] = useState(0);
  const [overflows, setOverflows] = useState(false);
  const input = useRef<TextInput>(null);
  // The text as of the last keystroke, read when a failed create puts its words back.
  const latest = useRef('');
  // Set synchronously, so a second Enter before the next render cannot send twice. Cleared when
  // the create itself ends, not when the list refetch that follows it does.
  const inFlight = useRef(false);
  const look = buttonLook('primary', 'default', 'enabled', colors);
  const ctx = useMemo<QuickAddContext>(
    () => ({
      today,
      members: (memberRows ?? []).map((m) => ({ id: m.userId, name: m.displayName })),
      locale: quickLocale(locale),
      disabled,
    }),
    [today, memberRows, disabled],
  );
  const parse = useMemo(() => quickParse(text, ctx), [text, ctx]);
  const create = useTaskMutation(
    async ({ id, task }: { id: string; task: NonNullable<ReturnType<typeof quickAddInput>> }) => {
      try {
        return await createTask(id, householdId as string, task);
      } finally {
        inFlight.current = false;
      }
    },
  );

  const changeText = (next: string) => {
    latest.current = next;
    setText(next);
    if (next.trim() === '') setDisabled(new Set());
  };

  const send = () => {
    const task = quickAddInput(text, assigneeId, dueOn, ctx);
    // An empty field is not an error: it just stays.
    if (task === null || householdId === undefined || inFlight.current) return;
    inFlight.current = true;
    // Cleared at once, so the next task can be typed while this one saves; put back on error.
    const typed = text;
    const dismissed = disabled;
    changeText('');
    create.mutate(
      { id: newTaskId(), task },
      {
        onSuccess: () => {
          input.current?.focus();
          void haptic('rigid');
        },
        onError: (error) => {
          // What was typed comes back, with its dismissed chips, only if nothing was typed since;
          // the notice carries the error.
          if (latest.current === '') {
            latest.current = typed;
            setText(typed);
            setDisabled(dismissed);
          }
          notify(taskErrorMessage(error));
        },
      },
    );
  };

  // The chip's words go back into the title; the kind stays off until the field empties.
  const drop = (kind: QuickSpanKind) => {
    if (dropSpan(parse, kind, text, ctx) === parse) return;
    setDisabled((current) => new Set([...current, kind]));
  };

  const highlighted = INLINE_HIGHLIGHT && parse.spans.length > 0 && !overflows;
  // The input and the drawing under it share these, so their letters sit on top of each other.
  const textStyle: TextStyle = {
    fontSize: 17,
    paddingHorizontal: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  };

  return (
    <View style={{ gap: space(2) }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: buttonMetrics('primary').minHeight,
          paddingLeft: space(4),
          paddingRight: space(1),
          borderRadius: radii.pill,
          // Same width in every state, so focusing never shifts the text.
          borderWidth: 2,
          borderColor: focused ? colors.cobalt : colors.outline,
          backgroundColor: colors.note,
        }}
      >
        <View
          style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center' }}
          onLayout={(e) => setFieldWidth(e.nativeEvent.layout.width)}
        >
          {INLINE_HIGHLIGHT && parse.spans.length > 0 ? (
            <View
              pointerEvents="none"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                },
                // Kept laid out while hidden, so it can tell when the text fits again.
                highlighted ? null : { opacity: 0 },
              ]}
            >
              <Text
                testID={`${testID}.highlight`}
                onTextLayout={(e) => {
                  const lines = e.nativeEvent.lines;
                  // A little room is kept for the caret at the end of the line.
                  setOverflows(lines.length > 1 || (lines[0]?.width ?? 0) > fieldWidth - space(2));
                }}
                style={[textStyle, { color: colors.ink }]}
              >
                {highlightRuns(text, parse.spans).map((run, i) => (
                  <Text
                    key={i}
                    style={run.kind === null ? undefined : { backgroundColor: colors.tonal }}
                  >
                    {run.text}
                  </Text>
                ))}
              </Text>
            </View>
          ) : null}
          <TextInput
            ref={input}
            testID={testID}
            value={text}
            onChangeText={changeText}
            onSubmitEditing={send}
            returnKeyType="done"
            // Keeps the keyboard up so several tasks go in one after another.
            submitBehavior="submit"
            autoCapitalize="sentences"
            autoCorrect={false}
            placeholder={placeholder}
            accessibilityLabel={placeholder}
            placeholderTextColor={colors.muted}
            selectionColor={colors.textSelection}
            cursorColor={colors.cobalt}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[
              textStyle,
              { paddingVertical: space(2), color: highlighted ? 'transparent' : colors.ink },
            ]}
          />
        </View>
        <Pressable
          testID={`${testID}.submit`}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.add')}
          // The circle is 40 dp inside the pill; the slop brings the touch area to 44 dp.
          hitSlop={space(1)}
          onPress={send}
          style={({ pressed }) => ({
            width: ADD_SIZE,
            height: ADD_SIZE,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: look.fill,
            opacity: pressedOpacity(pressed),
          })}
        >
          <Ionicons name={actionIcons.add} size={24} color={look.foreground} accessible={false} />
        </Pressable>
      </View>
      {parse.spans.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {parse.spans.map((span) => {
            const value = chipLabel(span.kind, parse, ctx, dueOn);
            return (
              <Pressable
                key={span.kind}
                testID={`${testID}.chip.${span.kind}`}
                accessibilityRole="button"
                accessibilityLabel={t('tasks.quickRemove', { value })}
                // 32 dp chips; the slop brings the touch area to 44 dp.
                hitSlop={(MIN_TOUCH - CHIP_HEIGHT) / 2}
                onPress={() => drop(span.kind)}
                style={({ pressed }) => ({
                  height: CHIP_HEIGHT,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space(1),
                  paddingLeft: space(3),
                  paddingRight: space(2),
                  borderRadius: radii.pill,
                  backgroundColor: colors.selection,
                  opacity: pressedOpacity(pressed),
                })}
              >
                <Ionicons
                  name={KIND_ICONS[span.kind]}
                  size={16}
                  color={colors.onSelection}
                  accessible={false}
                />
                <Text style={{ color: colors.onSelection, fontSize: 14, fontWeight: '600' }}>
                  {value}
                </Text>
                <Ionicons name="close" size={16} color={colors.onSelection} accessible={false} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
