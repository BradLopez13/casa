import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recurrenceLabel } from '@/domain/recurrence/label';
import {
  TEMPLATES,
  templateInputs,
  templateTitle,
  type TaskTemplate,
  type TemplateKey,
} from '@/domain/tasks/templates';
import { useMembership } from '@/features/households/queries';
import { createTask, newTaskId, type TaskInput } from '@/features/tasks/api';
import { HeaderAction } from '@/features/tasks/components/TaskForm';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useTaskMutation } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { ErrorText } from '@/ui/components/ErrorText';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';

const CHECK_SIZE = 26;

function TemplateRow({
  template,
  checked,
  onToggle,
}: {
  template: TaskTemplate;
  checked: boolean;
  onToggle: () => void;
}) {
  const { colors, radii, space } = useTheme();
  const label = [
    templateTitle(template),
    t(`rooms.${template.room}`),
    recurrenceLabel(template.rule),
  ].join(' · ');
  return (
    <Pressable
      testID={`templates.item.${template.key}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        paddingVertical: space(3),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* The check mark, not only the colour, shows the selection. */}
      <View
        style={{
          width: CHECK_SIZE,
          height: CHECK_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.day / 2,
          borderWidth: 2,
          borderColor: checked ? colors.cobalt : colors.outline,
          backgroundColor: checked ? colors.cobalt : colors.note,
        }}
      >
        {checked ? (
          <Ionicons name="checkmark" size={18} color={colors.onCobalt} accessible={false} />
        ) : null}
      </View>
      <Text maxFontSizeMultiplier={1.3} style={{ flex: 1, color: colors.ink, fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TemplatesScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const today = useToday();
  const queryClient = useQueryClient();
  const householdId = useMembership().data?.householdId;
  const [selected, setSelected] = useState<ReadonlySet<TemplateKey>>(new Set());
  // One id per template: a retry sends the same ids, so a task created before a failure
  // comes back as itself instead of a copy.
  const [ids] = useState(() => new Map(TEMPLATES.map((template) => [template.key, newTaskId()])));
  const save = useTaskMutation(async ({ tasks }: { tasks: [string, TaskInput][] }) => {
    for (const [id, input] of tasks) {
      await createTask(id, householdId as string, input);
    }
  });

  // Once a save fails the button stays "Reintentar", also while retrying, until one succeeds.
  const [failed, setFailed] = useState(false);
  // In TEMPLATES order, the same order templateInputs returns them in.
  const keys = TEMPLATES.map((template) => template.key).filter((key) => selected.has(key));
  const saving = save.isPending || save.isSuccess;
  const toggle = (key: TemplateKey) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const add = () => {
    if (householdId === undefined || keys.length === 0) return;
    const inputs = templateInputs(keys, today);
    const tasks = keys.map((key, i): [string, TaskInput] => [
      ids.get(key) as string,
      inputs[i] as TaskInput,
    ]);
    save.submit(
      { tasks },
      {
        onSuccess: () => router.back(),
        onError: () => {
          setFailed(true);
          // Some tasks may already exist: refresh the list so Hoy shows them (and drops the
          // templates card) even if the user cancels instead of retrying.
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
      },
    );
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
        <HeaderAction
          testID="templates.cancel"
          label={t('templates.cancel')}
          onPress={() => router.back()}
        />
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
          {t('templates.title')}
        </Text>
        <HeaderAction
          testID="templates.add"
          label={failed ? t('templates.retry') : t('templates.add', { n: keys.length })}
          onPress={add}
          disabled={keys.length === 0 || saving}
          busy={saving}
          strong
        />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space(5),
          paddingTop: space(3),
          paddingBottom: space(8),
        }}
      >
        {TEMPLATES.map((template) => (
          <TemplateRow
            key={template.key}
            template={template}
            checked={selected.has(template.key)}
            onToggle={() => toggle(template.key)}
          />
        ))}
        {save.error ? (
          <View style={{ paddingTop: space(4) }}>
            <ErrorText testID="templates.error">{taskErrorMessage(save.error)}</ErrorText>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
