import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { dayHeading } from '@/domain/tasks/labels';
import { weekStrip } from '@/domain/tasks/strip';
import { filterByAssignee, selectAll, selectWeek, type TaskItem } from '@/domain/tasks/views';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { DayStrip } from '@/features/tasks/components/DayStrip';
import { DoneTray } from '@/features/tasks/components/DoneTray';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { ModeSwitch, type TasksMode } from '@/features/tasks/components/ModeSwitch';
import { NewTaskButton } from '@/features/tasks/components/NewTaskButton';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { TaskNote } from '@/features/tasks/components/TaskNote';
import { useTaskFilter } from '@/features/tasks/filter';
import { useTasks, useToggleTask } from '@/features/tasks/queries';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { useMemberLabels } from '@/features/tasks/useMemberLabels';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { FridgeRefresh } from '@/ui/components/FridgeRefresh';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Row = { kind: 'note'; task: TaskItem } | { kind: 'tray'; tasks: TaskItem[] };
type Section = { key: string; title: string; count: number; data: Row[] };

const NO_TASKS: TaskItem[] = [];
/** Wait for the rows near the target to render before trying the scroll again. */
const SCROLL_RETRY_MS = 100;

const notes = (list: TaskItem[]) => list.map((task): Row => ({ kind: 'note', task }));

export default function TasksScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const today = useToday();
  const { userId } = useSession();
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const membersQuery = useMembers(householdId);
  const tasksQuery = useTasks(householdId);
  const { toggle, isBusy } = useToggleTask(householdId, userId);
  const filter = useTaskFilter();
  const [mode, setMode] = useState<TasksMode>('week');
  const [pulling, setPulling] = useState(false);
  const listRef = useRef<SectionList<Row, Section>>(null);
  // The section a strip tap is aiming for, kept for one retry if the first scroll fails.
  const pendingScroll = useRef<number | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const tasks = tasksQuery.data ?? NO_TASKS;
  // A filter on someone who has left the household falls back to the whole household.
  const assigneeId = members.some((m) => m.userId === filter.assigneeId) ? filter.assigneeId : null;

  const { marks, names } = useMemberLabels(members, userId);
  const filtered = useMemo(() => filterByAssignee(tasks, assigneeId), [tasks, assigneeId]);
  const week = useMemo(() => selectWeek(filtered, today), [filtered, today]);
  // Members arrive ordered by joined_at, so the dots follow join order.
  const strip = useMemo(
    () =>
      weekStrip(
        filtered,
        today,
        members.map((m) => m.userId),
      ),
    [filtered, today, members],
  );
  const counts = useMemo(
    () => new Map(week.days.map((day) => [day.date, day.tasks.length])),
    [week],
  );

  const sections = useMemo(() => {
    let all: Section[];
    if (mode === 'week') {
      all = [
        {
          key: 'overdue',
          title: t('tasks.section.overdue'),
          count: week.overdue.length,
          data: notes(week.overdue),
        },
        ...week.days.map((day) => ({
          key: day.date,
          title: dayHeading(day.date, today),
          count: day.tasks.length,
          data: notes(day.tasks),
        })),
      ];
    } else {
      const { dated, undated, done } = selectAll(filtered, today);
      all = [
        {
          key: 'dated',
          title: t('tasks.section.dated'),
          count: dated.length,
          data: notes(dated),
        },
        {
          key: 'undated',
          title: t('tasks.section.undated'),
          count: undated.length,
          data: notes(undated),
        },
        {
          key: 'done',
          title: t('tasks.section.done'),
          count: done.length,
          data: [{ kind: 'tray', tasks: done }],
        },
      ];
    }
    return all.filter((section) => section.count > 0);
  }, [mode, week, filtered, today]);

  const scrollToDay = (date: string) => {
    const sectionIndex = sections.findIndex((section) => section.key === date);
    // A day with nothing on it has no section: the tap does nothing.
    if (sectionIndex === -1) return;
    pendingScroll.current = sectionIndex;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0 });
  };

  const refresh = async () => {
    // refetch() ignores `enabled`, so never fire the queries without a household.
    if (householdId === undefined) return;
    setPulling(true);
    try {
      await Promise.all([tasksQuery.refetch(), membersQuery.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const openTask = (id: string) => router.push({ pathname: '/task/[id]', params: { id } });

  const door = (
    <DoorHeader title={t('tasks.title')} titleSize="medium">
      <View style={{ gap: space(4) }}>
        <MemberFilter
          members={members}
          marks={marks}
          userId={userId}
          selected={assigneeId}
          onToggle={filter.toggle}
        />
        <ModeSwitch value={mode} onChange={setMode} />
        {mode === 'week' ? (
          <DayStrip
            days={strip}
            today={today}
            marks={marks}
            counts={counts}
            onSelect={scrollToDay}
          />
        ) : null}
      </View>
    </DoorHeader>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <FridgeRefresh refreshing={pulling} onRefresh={() => void refresh()}>
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(row) => (row.kind === 'note' ? row.task.id : 'done-tray')}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={door}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: space(5), paddingTop: space(6) }}>
              <TaskListStates
                query={tasksQuery}
                empty={
                  <Text style={{ color: colors.muted, fontSize: 16 }}>{t('tasks.empty')}</Text>
                }
              />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.count} />
          )}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: space(5) }}>
              {item.kind === 'note' ? (
                <TaskNote
                  task={item.task}
                  today={today}
                  mark={item.task.assigneeId ? marks.get(item.task.assigneeId) : undefined}
                  assigneeName={item.task.assigneeId ? names.get(item.task.assigneeId) : undefined}
                  busy={isBusy(item.task.id)}
                  onToggle={() => toggle({ id: item.task.id, done: true })}
                  onOpen={() => openTask(item.task.id)}
                />
              ) : (
                <DoneTray
                  tasks={item.tasks}
                  marks={marks}
                  names={names}
                  onReopen={(task) => toggle({ id: task.id, done: false })}
                />
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
          // Rows vary in height, so a far section may not be measured yet: jump close to it,
          // let those rows render, then aim again.
          onScrollToIndexFailed={(info) => {
            listRef.current
              ?.getScrollResponder()
              ?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
            const target = pendingScroll.current;
            // Retry once only, so a list that never measures cannot loop.
            pendingScroll.current = null;
            if (target === null) return;
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryTimer.current = setTimeout(() => {
              retryTimer.current = null;
              listRef.current?.scrollToLocation({
                sectionIndex: target,
                itemIndex: 0,
                viewPosition: 0,
              });
            }, SCROLL_RETRY_MS);
          }}
          // Room under the last note so the floating "Nueva tarea" pill never covers it.
          contentContainerStyle={{ paddingBottom: MIN_TOUCH + space(12) }}
        />
      </FridgeRefresh>
      <NewTaskButton testID="tasks.new-task" assigneeId={assigneeId} />
    </View>
  );
}
