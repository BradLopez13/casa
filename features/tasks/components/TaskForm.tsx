import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MemberMark } from '@/domain/members/marks';
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

function HeaderAction({
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
  const set = (patch: Partial<TaskInput>) => setValues((current) => ({ ...current, ...patch }));

  const parsed = taskFormSchema.safeParse(values);
  const blank = values.title.trim() === '';
  // An empty title only disables Save; a too-long one says why.
  const titleInvalid =
    !blank && !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'title');
  // Room, assignee and date come from pickers, so in practice only the title can fail.
  const save = () => {
    if (parsed.success) onSave(parsed.data);
  };

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
            <DayCells value={values.dueOn} today={today} onChange={(dueOn) => set({ dueOn })} />
          </Field>
          {error ? <ErrorText testID="task-form.error">{error}</ErrorText> : null}
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
