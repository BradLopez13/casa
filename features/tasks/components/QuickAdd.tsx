import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextStyle,
} from 'react-native';
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
import { markHintSeen, useHint } from '@/features/hints/hints';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers } from '@/features/households/queries';
import { locale, t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { buttonLook, buttonMetrics, pressedOpacity } from '@/ui/buttonLook';
import { FirstUseHint } from '@/ui/components/FirstUseHint';
import { useNotice } from '@/ui/components/Notice';
import { haptic } from '@/ui/motion';
import { useTheme } from '@/ui/theme';
import { useDoorCompact } from '@/ui/components/doorContext';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { MIN_TOUCH } from '@/ui/tokens';
import { announce } from '@/ui/a11y';
import { positEdge } from '@/ui/positEdge';
import { newTaskId } from '../api';
import { markFresh } from '../freshIds';
import { quickAddInput, quickLocale, type QuickAddContext } from '../quickAddInput';
import { hintName, quickHintSegments, quickHintShown } from '../quickHint';
import { buildCreateOptions } from '../create';
import { useToday } from '../useToday';

const ADD_SIZE = 40;
/** The new task form's `due` for a task without a date (`app/task/new.tsx`). */
export const NO_DATE = 'none';
const CHIP_HEIGHT = 32;

const KIND_ICONS = {
  due: 'calendar-outline',
  repeat: 'repeat',
  assignee: 'person-outline',
  room: 'home-outline',
} as const satisfies Record<QuickSpanKind, keyof typeof Ionicons.glyphMap>;

type Props = {
  householdId: string | undefined;
  assigneeId: string | null;
  dueOn: string | null;
  placeholder: string;
  /** Whether the list under it shows notes: from ×1.3 the example then keeps quiet. */
  hasNotes: boolean;
  /**
   * Who the full form starts with when the «+» opens it from an empty field: by default the
   * person the field writes for; Tareas passes null (bloque 11).
   */
  formAssigneeId?: string | null;
  testID: string;
};

/** What a recognised part says on its chip: the date, the repeat, the person or the room. */
function chipLabel(
  kind: QuickSpanKind,
  parse: QuickParse,
  ctx: QuickAddContext,
  dueOn: string | null,
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
export function QuickAdd({
  householdId,
  assigneeId,
  dueOn,
  placeholder,
  hasNotes,
  formAssigneeId = assigneeId,
  testID,
}: Props) {
  const router = useRouter();
  const { colors, radii, space } = useTheme();
  const notify = useNotice();
  const today = useToday();
  const { data: memberRows } = useMembers(householdId);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  // Kinds dismissed for the text being typed; forgotten when the field empties.
  const [disabled, setDisabled] = useState<ReadonlySet<QuickSpanKind>>(() => new Set());
  const input = useRef<TextInput>(null);
  // The text as of the last keystroke: what Enter sends, and what a failed create puts back.
  const latest = useRef('');
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
  // Until a task goes in with something the field understood, the empty field shows an example.
  const quickAddOpen = useHint('quickAdd');
  // With large text it keeps quiet while there are notes: two of them in view come first.
  const { fontScale } = useWindowDimensions();
  const hintOpen = quickHintShown({ open: quickAddOpen, fontScale, hasNotes });
  // In a compact door (a phone on its side) the field shares a narrow column: the example is a
  // short one, on one line, so it is never cut half way (fase 10a).
  const inCompactDoor = useDoorCompact();
  const example = useMemo(() => {
    const name = inCompactDoor ? null : hintName(ctx.members, assigneeId);
    // In the compact door even «Regar mañana cada 2 días» ran past the column on the .51 on its
    // side: a shorter example that still underlines what the field understands.
    const sentence = inCompactDoor
      ? t('tasks.quickHint.exampleShort')
      : name === null
        ? t('tasks.quickHint.exampleAlone')
        : t('tasks.quickHint.example', { name });
    return { sentence, segments: quickHintSegments(sentence, ctx) };
  }, [ctx, assigneeId, inCompactDoor]);
  // Queued like a shopping add (fase 10e): the note shows at once, and without a connection it
  // waits and goes when the connection is back. A final error says so from the queue itself.
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const create = useMutation(buildCreateOptions(queryClient, notify));

  const changeText = (next: string) => {
    latest.current = next;
    setText(next);
    if (next.trim() === '') setDisabled(new Set());
  };

  // With the field empty the «+» opens the full form, with the day and the person of the context:
  // the form had no way in, and the button did nothing (bloque 11).
  const openForm = () => {
    const params: { due: string; assignee?: string } = { due: dueOn ?? NO_DATE };
    if (formAssigneeId !== null) params.assignee = formAssigneeId;
    router.push({ pathname: '/task/new', params });
  };

  const send = () => {
    // What the field holds right now, not as of the last render: the field empties below at once,
    // so a second Enter before the next render finds it empty and sends nothing twice.
    const typed = latest.current;
    const task = quickAddInput(typed, assigneeId, dueOn, ctx);
    // An empty field is not an error: it just stays.
    if (task === null || householdId === undefined) return;
    if (quickParse(typed, ctx).spans.length > 0) markHintSeen('quickAdd');
    // Cleared at once, so the next task can be typed while this one saves; put back on error.
    const dismissed = disabled;
    changeText('');
    const id = newTaskId();
    // Created here: its note lands with the pin choreography when it shows up in the list.
    markFresh(id);
    create.mutate(
      { id, householdId, userId, input: task },
      {
        onError: () => {
          // What was typed comes back, with its dismissed chips, only if nothing was typed since.
          if (latest.current === '') {
            latest.current = typed;
            setText(typed);
            setDisabled(dismissed);
          }
        },
      },
    );
    // The note is already in the list: the next task can be typed at once.
    input.current?.focus();
    void haptic('rigid');
    // The field just empties: with a screen reader, say what was added.
    announce(t('tasks.a11y.added', { title: task.title }));
  };

  // The chip's words go back into the title; the kind stays off until the field empties.
  const drop = (kind: QuickSpanKind) => {
    if (dropSpan(parse, kind, text, ctx) === parse) return;
    setDisabled((current) => new Set([...current, kind]));
  };

  // Text style of the input.
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
        <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center' }}>
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
            // A task title, not a name or an address: no autofill suggestions over the field.
            autoComplete="off"
            placeholder={placeholder}
            // One line under the door, capped like it: at ×2 the placeholder («Tarea para ti, el
            // miércoles…») wrapped and was cut, or ran under the «+».
            maxFontSizeMultiplier={DOOR_MAX_SCALE}
            accessibilityLabel={placeholder}
            placeholderTextColor={colors.muted}
            selectionColor={colors.textSelection}
            cursorColor={colors.cobalt}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[textStyle, { paddingVertical: space(2), color: colors.ink }]}
          />
        </View>
        <Pressable
          testID={`${testID}.submit`}
          accessibilityRole="button"
          accessibilityLabel={t(text.trim() === '' ? 'tasks.a11y.addMore' : 'tasks.a11y.addButton')}
          // The circle is 40 dp inside the pill; the slop brings the touch area to 44 dp.
          hitSlop={space(1)}
          onPress={() => (latest.current.trim() === '' ? openForm() : send())}
          style={({ pressed }) => ({
            width: ADD_SIZE,
            height: ADD_SIZE,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: look.fill,
            // With high contrast, the pósit on the white field gets its slate edge.
            ...positEdge(look.fill, colors),
            opacity: pressedOpacity(pressed),
          })}
        >
          <Ionicons name={actionIcons.add} size={24} color={look.foreground} accessible={false} />
        </Pressable>
      </View>
      {hintOpen && text === '' ? (
        <FirstUseHint
          testID={`${testID}.hint`}
          door
          numberOfLines={inCompactDoor ? 1 : undefined}
          readerText={`${t('tasks.quickHint.lead')} ${example.sentence}`}
          text={
            <>
              {`${t('tasks.quickHint.lead')} «`}
              {example.segments.map((segment, i) =>
                segment.known ? (
                  <Text
                    key={i}
                    style={{
                      color: colors.ink,
                      textDecorationLine: 'underline',
                      textDecorationColor: colors.outline,
                    }}
                  >
                    {segment.text}
                  </Text>
                ) : (
                  segment.text
                ),
              )}
              »
            </>
          }
        />
      ) : null}
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
