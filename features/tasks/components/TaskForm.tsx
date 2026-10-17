import { useRef, useState, type ReactNode } from 'react';
import {
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
import { dayHeading } from '@/domain/tasks/labels';
import { isDirty } from '@/features/forms/isDirty';
import { useDiscardGuard } from '@/features/forms/useDiscardGuard';
import type { Member } from '@/features/households/api';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { useModalFill } from '@/ui/components/ModalSheet';
import { TextField } from '@/ui/components/TextField';
import { FocusRevealContext } from '@/ui/focusReveal';
import { formDensity } from '@/ui/sheet';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';
import { useRevealFocusedField } from '@/ui/useRevealFocusedField';
import type { TaskInput } from '../api';
import { taskFormSchema } from '../schemas';
import { AssigneePicker } from './AssigneePicker';
import { DayCells } from './DayCells';
import { openFieldFor, type FormField } from './formState';
import { PropertyMagnets } from './PropertyMagnets';
import { RecurrencePicker } from './RecurrencePicker';
import { RoomPicker } from './RoomPicker';
import { saveErrorText } from './taskFormText';

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
  const { scroll, reveal } = useRevealFocusedField();
  const [values, setValues] = useState<TaskInput>(initial);
  // What the form opened with: a refreshed `initial` (realtime) must not count as an edit.
  const [opened] = useState(initial);
  const [open, setOpen] = useState<FormField | null>(() => openFieldFor(opened, isNew));
  const { requestClose, dialog } = useDiscardGuard({
    dirty: isDirty(opened, values),
    onCancel,
    busy: saving,
  });
  const [triedSave, setTriedSave] = useState(false);
  const titleRef = useRef<TextInput>(null);
  const set = (patch: Partial<TaskInput>) => setValues((current) => ({ ...current, ...patch }));
  // Tapping the open magnet closes it; tapping another swaps the picker.
  const toggle = (field: FormField) => setOpen((current) => (current === field ? null : field));
  // A monthly rule follows the date; weekly days stay as the user chose them. Re-tapping the
  // chosen day changes nothing, so a month-end rule on a short month keeps its day. Without the
  // repeat magnet the rule is not the user's to change, so it stays as it is.
  const setDueOn = (dueOn: string | null) =>
    setValues((current) =>
      dueOn === current.dueOn
        ? current
        : {
            ...current,
            dueOn,
            recurrence: repeatEditable
              ? syncMonthly(current.recurrence, dueOn)
              : current.recurrence,
          },
    );
  // A repeating task needs a date: choosing a repeat without one starts it today.
  const setRecurrence = (recurrence: RecurrenceRule | null) =>
    setValues((current) => ({
      ...current,
      recurrence,
      dueOn: recurrence !== null && current.dueOn === null ? today : current.dueOn,
    }));

  const parsed = taskFormSchema.safeParse(values);
  const blank = values.title.trim() === '';
  // An empty title is explained on Save; a too-long one says why as it is typed.
  const titleInvalid =
    !blank && !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'title');
  // The pickers keep a date while a repeat is set; should one still be missing, say so on Save.
  const needsDate = !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'dueOn');
  const save = () => {
    if (parsed.success) onSave(parsed.data);
    else {
      setTriedSave(true);
      if (blank) titleRef.current?.focus();
      else if (needsDate) setOpen('due');
    }
  };
  // The empty-title message goes away as soon as something is typed.
  const shownError =
    error ??
    (triedSave && blank
      ? saveErrorText('INVALID_TITLE')
      : triedSave && needsDate
        ? saveErrorText('RECURRENCE_NEEDS_DATE')
        : null);
  const repeating = values.recurrence !== null;
  // What completing it today would produce, as the server computes it: the first date after
  // max(dueOn, today).
  const nextDate =
    values.recurrence !== null && values.dueOn !== null
      ? dayHeading(
          calculateNextOccurrence(values.recurrence, values.dueOn, today),
          today,
        ).toLowerCase()
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
                    value={values.title}
                    onChangeText={(text) => set({ title: text })}
                    // On a short window the keyboard would hide the rest of the note, so there
                    // the field waits for a tap.
                    autoFocus={isNew && density.autoFocusTitle}
                    maxLength={200}
                    returnKeyType="done"
                    blurOnSubmit
                    // The keyboard's check mark takes the same path as Save.
                    onSubmitEditing={() => {
                      if (!saving) save();
                    }}
                    error={titleInvalid ? t('tasks.errors.INVALID_TITLE') : undefined}
                    inputStyle={{
                      fontFamily: displayFontBold,
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
                />
                {open === 'room' ? (
                  <RoomPicker value={values.room} onChange={(room) => set({ room })} />
                ) : null}
                {open === 'assignee' ? (
                  <AssigneePicker
                    value={values.assigneeId}
                    members={members}
                    marks={marks}
                    userId={userId}
                    onChange={(assigneeId) => set({ assigneeId })}
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
              {dangerZone}
            </FocusRevealContext.Provider>
          </ScrollView>
          {/* The foot: Save is the sheet's one pósit, fixed above the keyboard, with the other
              actions on the task right above it. */}
          <View
            style={{
              paddingHorizontal: space(5),
              paddingTop: space(3),
              paddingBottom: space(density.headerStep + 1),
              gap: space(3),
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              backgroundColor: colors.page,
            }}
          >
            {footer}
            <Button
              testID="task-form.save"
              title={t('taskForm.save')}
              onPress={save}
              loading={saving}
              width="full"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {dialog}
    </>
  );
}
