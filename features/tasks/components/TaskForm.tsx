import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MemberMark } from '@/domain/members/marks';
import { syncMonthly } from '@/domain/recurrence/form';
import { calculateNextOccurrence } from '@/domain/recurrence/next';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
import { dayHeading } from '@/domain/tasks/labels';
import type { Member } from '@/features/households/api';
import { t } from '@/i18n';
import { ErrorText } from '@/ui/components/ErrorText';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';
import type { TaskInput } from '../api';
import { taskFormSchema } from '../schemas';
import { AssigneePicker } from './AssigneePicker';
import { DayCells } from './DayCells';
import { RecurrencePicker } from './RecurrencePicker';
import { RoomPicker } from './RoomPicker';

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
  footer?: ReactNode;
};

export function HeaderAction({
  testID,
  label,
  onPress,
  disabled = false,
  busy = false,
  strong = false,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  strong?: boolean;
}) {
  const { colors, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space(1)}
      style={({ pressed }) => ({
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.cobalt, fontSize: 17, fontWeight: strong ? '700' : '400' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ gap: space(2) }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

/** The task form inside the create and edit modals, with its own Cancel | title | Save bar. */
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
  footer,
}: Props) {
  const { colors, space } = useTheme();
  const [values, setValues] = useState<TaskInput>(initial);
  const [triedSave, setTriedSave] = useState(false);
  const set = (patch: Partial<TaskInput>) => setValues((current) => ({ ...current, ...patch }));
  // A monthly rule follows the date; weekly days stay as the user chose them. Re-tapping the
  // chosen day changes nothing, so a month-end rule on a short month keeps its day.
  const setDueOn = (dueOn: string | null) =>
    setValues((current) =>
      dueOn === current.dueOn
        ? current
        : { ...current, dueOn, recurrence: syncMonthly(current.recurrence, dueOn) },
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
  // An empty title only disables Save; a too-long one says why.
  const titleInvalid =
    !blank && !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'title');
  // The pickers keep a date while a repeat is set; should one still be missing, say so on Save.
  const needsDate = !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'dueOn');
  const save = () => {
    if (parsed.success) onSave(parsed.data);
    else setTriedSave(true);
  };
  const shownError =
    error ?? (triedSave && needsDate ? t('tasks.errors.RECURRENCE_NEEDS_DATE') : null);
  const repeating = values.recurrence !== null;
  const nextDate =
    values.recurrence !== null && values.dueOn !== null
      ? dayHeading(calculateNextOccurrence(values.recurrence, values.dueOn, values.dueOn), today)
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space(2),
          paddingHorizontal: space(4),
          paddingVertical: space(2),
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
        }}
      >
        <HeaderAction testID="task-form.cancel" label={t('taskForm.cancel')} onPress={onCancel} />
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          style={{
            flex: 1,
            textAlign: 'center',
            color: colors.ink,
            fontFamily: displayFont,
            fontSize: 18,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
          }}
        >
          {title}
        </Text>
        <HeaderAction
          testID="task-form.save"
          label={t('taskForm.save')}
          onPress={save}
          disabled={blank || saving}
          busy={saving}
          strong
        />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: space(5),
            paddingTop: space(5),
            paddingBottom: space(8),
            gap: space(6),
          }}
        >
          <TextField
            testID="task-form.title"
            label={t('taskForm.titleLabel')}
            value={values.title}
            onChangeText={(text) => set({ title: text })}
            // Only a new task starts with an empty title.
            autoFocus={initial.title === ''}
            maxLength={200}
            returnKeyType="done"
            error={titleInvalid ? t('tasks.errors.INVALID_TITLE') : undefined}
          />
          <Field label={t('taskForm.roomLabel')}>
            <RoomPicker value={values.room} onChange={(room) => set({ room })} />
          </Field>
          <Field label={t('taskForm.assigneeLabel')}>
            <AssigneePicker
              value={values.assigneeId}
              members={members}
              marks={marks}
              userId={userId}
              onChange={(assigneeId) => set({ assigneeId })}
            />
          </Field>
          <Field label={t('taskForm.dueLabel')}>
            <DayCells
              value={values.dueOn}
              today={today}
              onChange={setDueOn}
              noneDisabled={repeating}
            />
          </Field>
          <Field label={t('taskForm.repeatLabel')}>
            <RecurrencePicker
              value={values.recurrence}
              dueOn={values.dueOn ?? today}
              onChange={setRecurrence}
            />
            {nextDate !== null ? (
              <Text
                testID="task-form.repeat.next"
                maxFontSizeMultiplier={1.3}
                style={{ color: colors.muted, fontSize: 13 }}
              >
                {t('taskForm.repeatNext', { date: nextDate })}
              </Text>
            ) : null}
          </Field>
          {shownError ? <ErrorText testID="task-form.error">{shownError}</ErrorText> : null}
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
