import { type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { addDays } from '@/domain/tasks/dates';
import { dayInSentence } from '@/domain/tasks/labels';
import { type StripDay } from '@/domain/tasks/strip';
import { emptyDayText } from '@/features/tasks/dayFilter';
import { QuickAdd } from '@/features/tasks/components/QuickAdd';
import { type TaskListSection } from '@/features/tasks/sections';
import { useTaskScreen } from '@/features/tasks/useTaskScreen';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';

/**
 * The field for the chosen day: Hoy and Mañana read as words, any other day as its name. No day
 * (Todas) adds the task undated.
 */
export function DayQuickAdd({
  screen,
  day,
  hasNotes,
}: {
  screen: Screen;
  day: string | null;
  hasNotes: boolean;
}) {
  const { today, userId, membership } = screen;
  const placeholder =
    day === null
      ? t('tasks.quickAddUndated')
      : day === today
        ? t('today.quickAdd')
        : day === addDays(today, 1)
          ? t('tasks.quickAddTomorrow')
          : t('tasks.quickAddDay', { day: dayInSentence(day, today) });
  return (
    <QuickAdd
      testID="tasks.quick-add"
      householdId={membership?.householdId}
      assigneeId={userId}
      dueOn={day}
      placeholder={placeholder}
      hasNotes={hasNotes}
      // Tareas is everyone's: the full form starts with no one (bloque 11).
      formAssigneeId={null}
    />
  );
}

/**
 * A chosen day with nothing on it says so by name, in one line. It offers nothing else: the quick
 * add for that same day is right above it.
 */
export function EmptyDay({ day, today }: { day: string; today: string }) {
  const { colors } = useTheme();
  return (
    <Text testID="tasks.empty-day" style={{ color: colors.muted, fontSize: 16 }}>
      {emptyDayText(day, today)}
    </Text>
  );
}

/** Todas offers the catalogue of typical chores the household does not have yet. */
export function IdeasButton() {
  const router = useRouter();
  return (
    <Button
      testID="tasks.ideas"
      title={t('tasks.ideas')}
      icon={actionIcons.templates}
      variant="tertiary"
      width="hug"
      onPress={() => router.push('/templates')}
    />
  );
}

export type Screen = ReturnType<typeof useTaskScreen>;

/** What both layouts share: the week's days, the chosen one (or none) and the list pieces. */
export type TasksParts = {
  screen: Screen;
  strip: StripDay[];
  /** The list: everything pending with no day chosen, or the chosen day alone. */
  sections: TaskListSection[];
  /** The day the list is filtered by, or null for «Todas»; held by the screen so a turn keeps it. */
  day: string | null;
  chooseDay: (date: string | null) => void;
  empty: ReactNode;
  /** The door's line under its headline: what is yours (or the household's) in all. */
  doorLine: string;
};
