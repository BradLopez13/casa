import { useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MemberMark } from '@/domain/members/marks';
import { syncMonthly } from '@/domain/recurrence/form';
import { calculateNextOccurrence } from '@/domain/recurrence/next';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
import { dayInSentence } from '@/domain/tasks/labels';
import { isDirty } from '@/features/forms/isDirty';
import { useDiscardGuard } from '@/features/forms/useDiscardGuard';
import type { Member } from '@/features/households/api';
import { locale, t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { useModalFill } from '@/ui/components/ModalSheet';
import { TextField } from '@/ui/components/TextField';
import { FocusRevealContext } from '@/ui/focusReveal';
import { formDensity } from '@/ui/sheet';
import { MoreBelowFade, useMoreBelow } from '@/ui/components/MoreBelowFade';
import { useTheme } from '@/ui/theme';
import { displayFontBold, displayFontRegular } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';
import { useRevealFocusedField } from '@/ui/useRevealFocusedField';
import { oneLineTitle } from '@/domain/tasks/title';
import type { TaskInput } from '../api';
import { parsedFormValues, quickLocale } from '../quickAddInput';
import { taskFormSchema } from '../schemas';
import { AssigneePicker } from './AssigneePicker';
import { DayCells } from './DayCells';
import { openFieldFor, type FormField } from './formState';
import { PropertyMagnets } from './PropertyMagnets';
import { RecurrencePicker } from './RecurrencePicker';
import { RoomPicker } from './RoomPicker';
import { invalidFieldError, saveErrorText } from './taskFormText';

type Props = {
  title: string;
  initial: TaskInput;
  members: Member[];
  marks: Map<string, MemberMark>;
  userId: string | null;
  today: string;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (input: TaskInput) => void;
  /** A task being created: the title takes the focus and the day picker starts open. */
  isNew: boolean;
  /** Secondary actions at the foot, above Save ("Marcar como hecha", "Saltar esta vez"). */
  footer?: ReactNode;
  /** Kept apart from the foot, at the end of the scroll ("Borrar tarea"). */
  dangerZone?: ReactNode;
  /**
   * False on a completed or skipped occurrence: a rule added there would start a series that
   * never generates a successor. The repeat magnet waits and the rule saves as it was.
   */
  repeatEditable?: boolean;
};

const TITLE_SIZE = 26;

/**
 * The task form inside the create and edit modals: a blank note with the title on top, a row of
 * property magnets that open their pickers one at a time, and Save fixed at the foot.
 */
export function TaskForm({
  title,
  initial,
  members,
  marks,
  userId,
  today,
  saving,
  error,
  onCancel,
  onSave,
  isNew,
  footer,
  dangerZone,
  repeatEditable = true,
}: Props) {
  const { colors, radii, noteEdge, space } = useTheme();
  const { fill, avoidKeyboard, edges } = useModalFill();
  const density = formDensity(useLayout());
  const { scroll, reveal, show } = useRevealFocusedField();
  const more = useMoreBelow();
  const picker = useRef<View>(null);
  // What the person typed and chose; `values` adds what the title says.
  const [typed, setTyped] = useState<TaskInput>(initial);
  // Fields chosen by hand: the title no longer fills them and their words stay in it.
  const [touched, setTouched] = useState<ReadonlySet<FormField>>(() => new Set());
  // Without the repeat magnet the rule is not the user's to change, nor the title's.
  const skipped = repeatEditable ? touched : new Set<FormField>([...touched, 'repeat']);
  // Only a new task reads its title: editing an existing one never reassigns or rewrites it.
  const values = isNew
    ? parsedFormValues(
        typed,
        skipped,
        {
          today,
          members: members.map((m) => ({ id: m.userId, name: m.displayName })),
          locale: quickLocale(locale),
        },
        repeatEditable,
      )
    : typed;
  // What the form opened with: a refreshed `initial` (realtime) must not count as an edit.
  const [opened] = useState(initial);
  const [open, setOpen] = useState<FormField | null>(() => openFieldFor(opened, isNew));
  const dirty = isDirty(opened, typed) || isDirty(opened, values);
  const { requestClose, dialog } = useDiscardGuard({ dirty, onCancel, busy: saving });
  const [triedSave, setTriedSave] = useState(false);
  const titleRef = useRef<TextInput>(null);
  // A value chosen in a picker is the person's: the title stops filling that field.
  const choose = (field: FormField, patch: Partial<TaskInput>) => {
    setTouched((current) => (current.has(field) ? current : new Set([...current, field])));
    setTyped((current) => ({ ...current, ...patch }));
  };
  // Tapping the open magnet closes it; tapping another swaps the picker. Opening one puts the
  // keyboard away, so the picker is not under it, and its block scrolls into view on layout.
  const toggle = (field: FormField) => {
    if (open !== field) Keyboard.dismiss();
    setOpen((current) => (current === field ? null : field));
  };
  // A monthly rule follows the date; weekly days stay as the user chose them. Re-tapping the
  // chosen day changes nothing, so a month-end rule on a short month keeps its day. Without the
  // repeat magnet the rule is not the user's to change, so it stays as it is.
  const setDueOn = (dueOn: string | null) => {
    if (dueOn === values.dueOn) return;
    choose('due', {
      dueOn,
      recurrence: repeatEditable ? syncMonthly(typed.recurrence, dueOn) : typed.recurrence,
    });
  };
  // A repeating task needs a date: choosing a repeat without one starts it today.
  const setRecurrence = (recurrence: RecurrenceRule | null) =>
    choose('repeat', {
      recurrence,
      dueOn: recurrence !== null && values.dueOn === null ? today : typed.dueOn,
    });

  const parsed = taskFormSchema.safeParse(values);
  const blank = values.title.trim() === '';
  // An empty title is explained on Save; a too-long one says why as it is typed.
  const titleInvalid =
    !blank && !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'title');
  // The pickers keep a date while a repeat is set; should one still be missing, say so on Save.
  const needsDate = !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'dueOn');
  // Any other property that cannot be saved (a link that named someone not in the household).
  const otherField = parsed.success
    ? undefined
    : parsed.error.issues
        .map((issue) => String(issue.path[0]))
        .find((field) => field !== 'title' && field !== 'dueOn');
  const other = otherField === undefined ? null : invalidFieldError(otherField);
  const save = () => {
    if (parsed.success) onSave(parsed.data);
    else {
      setTriedSave(true);
      if (blank) titleRef.current?.focus();
      else if (needsDate) setOpen('due');
      else if (other?.open) setOpen(other.open);
    }
  };
  // The empty-title message goes away as soon as something is typed.
  const shownError =
    error ??
    (triedSave && blank
      ? saveErrorText('INVALID_TITLE')
      : triedSave && needsDate
        ? saveErrorText('RECURRENCE_NEEDS_DATE')
        : triedSave && !titleInvalid && other
          ? other.text
          : null);
  const repeating = values.recurrence !== null;
  // What completing it today would produce, as the server computes it: the first date after
  // max(dueOn, today).
  const nextDate =
    values.recurrence !== null && values.dueOn !== null
      ? dayInSentence(calculateNextOccurrence(values.recurrence, values.dueOn, today), today)
      : null;

  const assigneeMember = members.find((m) => m.userId === values.assigneeId);
  const assigneeMark = assigneeMember ? marks.get(assigneeMember.userId) : undefined;
  const assignee =
    assigneeMember && assigneeMark
      ? {
          name:
            assigneeMember.userId === userId ? t('members.youName') : assigneeMember.displayName,
          mark: assigneeMark,
        }
      : null;
  // The date it was due on, kept as a choice while editing an overdue task.
  const pastDue = opened.dueOn !== null && opened.dueOn < today ? opened.dueOn : null;

  // Dark has its 1 dp edge; light has none (the shadow did the work), so a hairline stands in,
  // as on the shopping sheet.
  const hasEdge = noteEdge.borderWidth > 0;

  return (
    <>
      <SafeAreaView edges={edges} style={[fill, { backgroundColor: colors.page }]}>
        <ModalHeader
          title={title}
          step={density.headerStep}
          cancel={{
            testID: 'task-form.cancel',
            label: t('taskForm.cancel'),
            onPress: requestClose,
          }}
        />
        <KeyboardAvoidingView
          enabled={avoidKeyboard}
          style={fill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            {...scroll}
            onScroll={(event) => {
              scroll.onScroll(event);
              more.onScroll(event);
            }}
            onLayout={(event) => {
              scroll.onLayout(event);
              more.onLayout(event);
            }}
            onContentSizeChange={more.onContentSizeChange}
            style={fill}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: space(5),
              paddingTop: space(density.topStep),
              paddingBottom: space(density.bottomStep),
              gap: space(density.gapStep),
            }}
          >
            {/* Every field asks for it on focus, as in CenteredCard. */}
            <FocusRevealContext.Provider value={reveal}>
              <View
                style={{
                  padding: space(4),
                  gap: space(4),
                  borderRadius: radii.note,
                  backgroundColor: colors.note,
                  borderWidth: hasEdge ? noteEdge.borderWidth : StyleSheet.hairlineWidth,
                  borderColor: hasEdge ? noteEdge.borderColor : colors.hairline,
                }}
              >
                <View style={{ gap: space(2) }}>
                  <TextField
                    ref={titleRef}
                    bare
                    testID="task-form.title"
                    label={t('taskForm.titleLabel')}
                    placeholder={t('taskForm.titlePlaceholder')}
                    value={typed.title}
                    onChangeText={(text) =>
                      setTyped((current) => ({ ...current, title: oneLineTitle(text) }))
                    }
                    // On a short window the keyboard would hide the rest of the note, so there
                    // the field waits for a tap.
                    autoFocus={isNew && density.autoFocusTitle}
                    maxLength={200}
                    // A task title: no autofill suggestions over the note.
                    autoComplete="off"
                    returnKeyType="done"
                    // Wraps instead of scrolling sideways: with large text a long title showed only
                    // its end. Return still submits, so a title never gets a line break.
                    multiline
                    submitBehavior="blurAndSubmit"
                    // The keyboard's check mark takes the same path as Save.
                    onSubmitEditing={() => {
                      if (!saving) save();
                    }}
                    error={titleInvalid ? t('tasks.errors.INVALID_TITLE') : undefined}
                    inputStyle={{
                      // The example («Sacar la basura») at the regular weight, so it never
                      // reads as a title already typed.
                      fontFamily: typed.title === '' ? displayFontRegular : displayFontBold,
                      fontSize: TITLE_SIZE,
                      ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                    }}
                  />
                  {/* Right under the title, so the empty-title message is seen where it is fixed. */}
                  {shownError ? <ErrorText testID="task-form.error">{shownError}</ErrorText> : null}
                </View>
                <PropertyMagnets
                  room={values.room}
                  assignee={assignee}
                  due={values.dueOn}
                  repeat={values.recurrence}
                  today={today}
                  open={open}
                  onOpen={toggle}
                  repeatEditable={repeatEditable}
                  // The open picker, right under its magnet, measured as one block so it scrolls
                  // into view whole.
                  picker={
                    open !== null ? (
                      <View
                        key={open}
                        ref={picker}
                        onLayout={() => show(picker.current)}
                        style={{ paddingBottom: space(3) }}
                      >
                        {open === 'room' ? (
                          <RoomPicker
                            value={values.room}
                            onChange={(room) => choose('room', { room })}
                          />
                        ) : null}
                        {open === 'assignee' ? (
                          <AssigneePicker
                            value={values.assigneeId}
                            members={members}
                            marks={marks}
                            userId={userId}
                            onChange={(assigneeId) => {
                              if (assigneeId !== values.assigneeId)
                                choose('assignee', { assigneeId });
                            }}
                          />
                        ) : null}
                        {open === 'due' ? (
                          <DayCells
                            value={values.dueOn}
                            today={today}
                            onChange={setDueOn}
                            noneDisabled={repeating}
                            past={pastDue}
                          />
                        ) : null}
                        {open === 'repeat' && repeatEditable ? (
                          <View style={{ gap: space(3) }}>
                            <RecurrencePicker
                              value={values.recurrence}
                              dueOn={values.dueOn ?? today}
                              onChange={setRecurrence}
                            />
                            {nextDate !== null ? (
                              <Text
                                testID="task-form.repeat.next"
                                style={{ color: colors.muted, fontSize: 13 }}
                              >
                                {t('taskForm.repeatNext', { date: nextDate })}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null
                  }
                />
              </View>
              {dangerZone}
            </FocusRevealContext.Provider>
          </ScrollView>
          {/* On a phone on its side the fourth magnet sat cut under the foot with nothing to say
              there was more: the page fades in over it (fase 10c). */}
          <MoreBelowFade visible={more.below} />
          {/* The foot: Save is the sheet's one pósit, fixed above the keyboard, with the other
              actions on the task right above it, or beside it on a short window. */}
          <View
            style={{
              ...(density.footRow ? { flexDirection: 'row', alignItems: 'center' } : null),
              paddingHorizontal: space(5),
              paddingTop: space(3),
              paddingBottom: space(density.headerStep + 1),
              gap: space(3),
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              backgroundColor: colors.page,
            }}
          >
            {density.footRow ? <View style={{ flex: 1 }}>{footer}</View> : footer}
            <Button
              testID="task-form.save"
              title={t('taskForm.save')}
              onPress={save}
              // Editing: nothing to save until something changed, so Save waits faded (the
              // contract's disabled look) instead of inviting a tap that does nothing.
              disabled={!isNew && !dirty}
              loading={saving}
              width={density.footRow ? 'hug' : 'full'}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {dialog}
    </>
  );
}
