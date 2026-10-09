import { useRouter, type RelativePathString } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, Text, View, type TextStyle } from 'react-native';
import { memberMarks } from '@/domain/members/marks';
import { longDateLabel } from '@/domain/tasks/labels';
import { tallyToday } from '@/domain/tasks/tally';
import { filterByAssignee, selectToday, type TaskItem } from '@/domain/tasks/views';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { DoneTray } from '@/features/tasks/components/DoneTray';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { NewTaskButton } from '@/features/tasks/components/NewTaskButton';
import { TallyView } from '@/features/tasks/components/Tally';
import { TaskNote } from '@/features/tasks/components/TaskNote';
import { useTaskFilter } from '@/features/tasks/filter';
import { useTasks, useToggleTask } from '@/features/tasks/queries';
import { scopeLabel } from '@/features/tasks/scope';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { useToday } from '@/features/tasks/useToday';
import { t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { FridgeRefresh } from '@/ui/components/FridgeRefresh';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Row = { kind: 'note'; task: TaskItem } | { kind: 'tray'; tasks: TaskItem[] };
type Section = { key: string; title: MessageKey; count: number; data: Row[] };

const NO_TASKS: TaskItem[] = [];

export default function TodayScreen() {
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
  const [pulling, setPulling] = useState(false);
  const subtitleStyle: TextStyle = {
    color: colors.muted,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  };

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const tasks = tasksQuery.data ?? NO_TASKS;
  // A filter on someone who has left the household falls back to the whole household.
  const assigneeId = members.some((m) => m.userId === filter.assigneeId) ? filter.assigneeId : null;

  const marks = useMemo(() => memberMarks(members), [members]);
  const names = useMemo(
    () =>
      new Map(
        members.map((m) => [m.userId, m.userId === userId ? t('members.youName') : m.displayName]),
      ),
    [members, userId],
  );
  const filtered = useMemo(() => filterByAssignee(tasks, assigneeId), [tasks, assigneeId]);
  const tally = useMemo(() => tallyToday(filtered, today), [filtered, today]);
  const sections = useMemo(() => {
    const { overdue, dueToday, doneToday } = selectToday(filtered, today);
    const notes = (list: TaskItem[]) => list.map((task): Row => ({ kind: 'note', task }));
    const all: Section[] = [
      {
        key: 'overdue',
        title: 'tasks.section.overdue',
        count: overdue.length,
        data: notes(overdue),
      },
      { key: 'today', title: 'tasks.section.today', count: dueToday.length, data: notes(dueToday) },
      {
        key: 'doneToday',
        title: 'tasks.section.doneToday',
        count: doneToday.length,
        data: [{ kind: 'tray', tasks: doneToday }],
      },
    ];
    return all.filter((section) => section.count > 0);
  }, [filtered, today]);

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

  const openTask = (id: string) =>
    // Cast until the task/[id] route file exists (Task 8); remove once Task 8 adds the route.
    router.push({ pathname: '/task/[id]' as RelativePathString, params: { id } });

  const empty =
    members.length === 1 ? (
      <View style={{ gap: space(4) }}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>
          {t('today.empty.title')}
        </Text>
        <Text style={{ color: colors.ink, fontSize: 16 }}>{t('today.empty.body')}</Text>
        <Button
          testID="today.invite"
          title={t('today.empty.cta')}
          onPress={() => router.push('/household/members')}
        />
      </View>
    ) : (
      <Text style={{ color: colors.muted, fontSize: 16 }}>{t('today.nothing')}</Text>
    );

  const door = (
    <DoorHeader
      title={t('today.title')}
      subtitle={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Text style={subtitleStyle}>{`${longDateLabel(today)} · `}</Text>
          <Text testID="today.household-name" style={subtitleStyle}>
            {membership?.householdName ?? ''}
          </Text>
        </View>
      }
    >
      <View style={{ gap: space(4) }}>
        <MemberFilter
          members={members}
          marks={marks}
          userId={userId}
          selected={assigneeId}
          onToggle={filter.toggle}
        />
        <TallyView tally={tally} scope={scopeLabel(assigneeId, userId, members)} />
      </View>
    </DoorHeader>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <FridgeRefresh refreshing={pulling} onRefresh={() => void refresh()}>
        <SectionList
          sections={sections}
          keyExtractor={(row) => (row.kind === 'note' ? row.task.id : 'done-tray')}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={door}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: space(5), paddingTop: space(6) }}>
              <TaskListStates query={tasksQuery} empty={empty} />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingHorizontal: space(5),
                paddingTop: space(6),
                paddingBottom: space(3),
              }}
            >
              <Text
                accessibilityRole="header"
                maxFontSizeMultiplier={1.3}
                style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}
              >
                {t(section.title)}
              </Text>
              <Text
                maxFontSizeMultiplier={1.3}
                style={{ color: colors.muted, fontSize: 15, fontVariant: ['tabular-nums'] }}
              >
                {section.count}
              </Text>
            </View>
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
          // Room under the last note so the floating "Nueva tarea" pill never covers it.
          contentContainerStyle={{ paddingBottom: MIN_TOUCH + space(12) }}
        />
      </FridgeRefresh>
      <NewTaskButton testID="today.new-task" assigneeId={assigneeId} />
    </View>
  );
}
