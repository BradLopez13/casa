import { useRouter } from 'expo-router';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { SectionList, Text, View, type TextStyle } from 'react-native';
import { longDateLabel } from '@/domain/tasks/labels';
import { tallyToday } from '@/domain/tasks/tally';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import {
  NewTaskButton,
  useNewTaskLane,
  useNewTaskListStyle,
} from '@/features/tasks/components/NewTaskButton';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { TallyView } from '@/features/tasks/components/Tally';
import { TemplatesCard } from '@/features/tasks/components/TemplatesCard';
import { TaskRow, TaskRowSeparator, taskRowKey } from '@/features/tasks/components/TaskRow';
import { TaskSections } from '@/features/tasks/components/TaskSections';
import { scopeLabel } from '@/features/tasks/scope';
import { todaySections, type TaskListSection } from '@/features/tasks/sections';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { doneEmpty, todayCards, todayPanes, type TodayCards } from '@/features/tasks/todayPanes';
import { useTaskScreen } from '@/features/tasks/useTaskScreen';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { FridgeRefresh, usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useOneColumn } from '@/ui/useOneColumn';
import { useLayout } from '@/ui/useLayout';
import { actionIcons } from '@/ui/actionIcons';

type Screen = ReturnType<typeof useTaskScreen>;

/** What both layouts share: the door, the sections, the cards and the empty-state pieces. */
type TodayParts = {
  screen: Screen;
  door: ReactElement;
  sections: TaskListSection[];
  cards: TodayCards;
  invite: ReactNode;
  nothing: ReactNode;
};

export default function TodayScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const screen = useTaskScreen();
  const { today, userId, membership, members, tasksQuery, assigneeId, filtered } = screen;
  const subtitleStyle: TextStyle = {
    color: colors.muted,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  };

  const tally = useMemo(() => tallyToday(filtered, today), [filtered, today]);
  const sections = useMemo(() => todaySections(filtered, today), [filtered, today]);
  const cards = todayCards({
    loaded: tasksQuery.isSuccess,
    taskCount: tasksQuery.data?.length ?? 0,
    memberCount: members.length,
    listEmpty: sections.length === 0,
  });

  const invite = (
    <View style={{ gap: space(4) }}>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>
        {t('today.empty.title')}
      </Text>
      <Text style={{ color: colors.ink, fontSize: 16 }}>{t('today.empty.body')}</Text>
      <Button
        testID="today.invite"
        title={t('today.empty.cta')}
        variant="primary"
        icon={actionIcons.invite}
        onPress={() => router.push('/household/members')}
      />
    </View>
  );
  const nothing = <Text style={{ color: colors.muted, fontSize: 16 }}>{t('today.nothing')}</Text>;

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
      status={<TallyView tally={tally} scope={scopeLabel(assigneeId, userId, members)} />}
    >
      <MemberFilter
        members={members}
        marks={screen.marks}
        userId={userId}
        selected={assigneeId}
        onToggle={screen.toggleFilter}
      />
    </DoorHeader>
  );

  const parts: TodayParts = { screen, door, sections, cards, invite, nothing };
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {paneMode(layout) === 'split' ? <TodaySplit {...parts} /> : <TodayStack {...parts} />}
      <NewTaskButton testID="today.new-task" assigneeId={assigneeId} />
    </View>
  );
}

/**
 * One column (phones, small tablets): the list as it has always been, pulled by the door. The door
 * runs edge to edge; every row, heading and empty state keeps to the column (`useOneColumn`), as
 * the door is the list's header and the list's own padding would take it in too.
 */
function TodayStack({ screen, door, sections, cards, invite, nothing }: TodayParts) {
  const { space } = useTheme();
  const listStyle = useNewTaskListStyle();
  // The round "+" of a short window keeps a lane of its own, clear of every row and count.
  const column = useOneColumn(useNewTaskLane());
  const { today, userId, members, tasksQuery } = screen;
  return (
    <FridgeRefresh refreshing={screen.pulling} onRefresh={() => void screen.refresh()}>
      <SectionList
        sections={sections}
        keyExtractor={taskRowKey}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={door}
        ListEmptyComponent={
          <View style={[column, { paddingTop: space(6), gap: space(6) }]}>
            {/* Only a household with no tasks at all, whatever the filter, gets the templates. */}
            {cards.templates ? <TemplatesCard /> : null}
            <TaskListStates query={tasksQuery} empty={members.length === 1 ? invite : nothing} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={column}>
            <SectionHeader title={section.title} count={section.count} flush />
          </View>
        )}
        renderItem={({ item }) => (
          <View style={column}>
            <TaskRow
              row={item}
              today={today}
              marks={screen.marks}
              names={screen.names}
              userId={userId}
              isBusy={screen.isBusy}
              toggle={screen.toggle}
              flush
            />
          </View>
        )}
        ItemSeparatorComponent={TaskRowSeparator}
        contentContainerStyle={listStyle}
      />
    </FridgeRefresh>
  );
}

/**
 * Two panes (wide screens): what is still to do on the left, what was done today and the
 * household's cards on the right, under a fixed door. The door is outside any scroll, so the
 * left pane takes the pull-to-refresh.
 */
function TodaySplit({ screen, door, sections, cards, invite, nothing }: TodayParts) {
  const { colors, space } = useTheme();
  const listStyle = useNewTaskListStyle();
  const lane = useNewTaskLane();
  const refreshControl = usePaneRefreshControl(screen.pulling, () => void screen.refresh());
  const { left, right } = todayPanes(sections);
  const rows = {
    today: screen.today,
    marks: screen.marks,
    names: screen.names,
    userId: screen.userId,
    isBusy: screen.isBusy,
    toggle: screen.toggle,
  };
  const hasCards = cards.templates || cards.invite;
  const noneDone = doneEmpty({
    loaded: screen.tasksQuery.isSuccess,
    rightCount: right.length,
    cards,
  });

  return (
    <TwoPane
      header={door}
      leftTestID="today.pane.pending"
      rightTestID="today.pane.done"
      refreshControl={refreshControl}
      contentContainerStyle={listStyle}
      rightLane={lane}
      left={
        left.length > 0 ? (
          <TaskSections sections={left} {...rows} />
        ) : (
          <View style={{ paddingTop: space(6) }}>
            <TaskListStates query={screen.tasksQuery} empty={nothing} />
          </View>
        )
      }
      right={
        <>
          <TaskSections sections={right} {...rows} />
          {hasCards ? (
            <View style={{ paddingTop: space(6), gap: space(6) }}>
              {cards.templates ? <TemplatesCard /> : null}
              {cards.invite ? invite : null}
            </View>
          ) : null}
          {/* Nothing done yet: the pane still opens with its heading, level with the left one,
              and the quiet line under it, so it never floats as a message for the whole screen. */}
          {noneDone ? (
            <View>
              <SectionHeader title={t('tasks.section.doneToday')} count={0} flush />
              <Text testID="today.pane.done-empty" style={{ color: colors.muted, fontSize: 16 }}>
                {t('today.done.empty')}
              </Text>
            </View>
          ) : null}
        </>
      }
    />
  );
}
