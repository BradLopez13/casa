import { useRouter } from 'expo-router';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { SectionList, Text, View, type TextStyle } from 'react-native';
import { longDateLabel } from '@/domain/tasks/labels';
import { todayLine } from '@/domain/tasks/todayLine';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { QuickAdd } from '@/features/tasks/components/QuickAdd';
import { TallyView } from '@/features/tasks/components/Tally';
import { TemplatesCard } from '@/features/tasks/components/TemplatesCard';
import { TaskRow, TaskRowSeparator, taskRowKey } from '@/features/tasks/components/TaskRow';
import { TaskSections } from '@/features/tasks/components/TaskSections';
import { todaySections, type TaskListSection } from '@/features/tasks/sections';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { doneEmpty, todayCards, todayPanes, type TodayCards } from '@/features/tasks/todayPanes';
import { useTaskScreen } from '@/features/tasks/useTaskScreen';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { FridgeRefresh, usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useOneColumn } from '@/ui/useOneColumn';
import { useLayout } from '@/ui/useLayout';
import { useListEndPadding } from '@/ui/useTabBarClearance';
import { actionIcons } from '@/ui/actionIcons';

type Screen = ReturnType<typeof useTaskScreen>;

/** What both layouts share: the door, the sections, the cards and the empty-state pieces. */
type TodayParts = {
  screen: Screen;
  door: ReactElement;
  quickAdd: ReactElement;
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
  const filterName = members.find((m) => m.userId === assigneeId)?.displayName ?? '';
  const dateStyle: TextStyle = {
    color: colors.muted,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  };

  // The door counts the whole household, so the line can say what is left for everyone else.
  const tasks = tasksQuery.data;
  const line = useMemo(
    () => todayLine({ tasks: tasks ?? [], today, userId, filter: assigneeId, filterName }),
    [tasks, today, userId, assigneeId, filterName],
  );
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
        // The quick add is this screen's pósit: inviting stays secondary.
        variant="secondary"
        icon={actionIcons.invite}
        onPress={() => router.push('/household/members')}
      />
    </View>
  );
  // When the door already says there is nothing for this view, the list does not say it twice.
  const doorSaysNothing =
    line.kind === 'empty' ||
    line.kind === 'allDone' ||
    line.kind === 'nothingMine' ||
    (line.kind === 'person' && line.count === 0);
  const nothing = doorSaysNothing ? null : (
    <Text style={{ color: colors.muted, fontSize: 16 }}>{t('today.nothing')}</Text>
  );

  const door = (
    <>
      <DoorHeader
        eyebrow={t('today.title')}
        trailing={<Text style={dateStyle}>{longDateLabel(today)}</Text>}
        heading={<TallyView line={line} onSeeAll={() => screen.selectFilter(null)} />}
      >
        <MemberFilter
          members={members}
          marks={screen.marks}
          userId={userId}
          selected={assigneeId}
          onSelect={screen.selectFilter}
        />
      </DoorHeader>
      {screen.showStaleBand ? (
        <OfflineBand label={t('offline.showingLast')} testID="tasks.offline" />
      ) : null}
    </>
  );
  const quickAdd = (
    <QuickAdd
      testID="today.quick-add"
      householdId={membership?.householdId}
      assigneeId={userId}
      dueOn={today}
      placeholder={t('today.quickAdd')}
    />
  );

  const parts: TodayParts = { screen, door, quickAdd, sections, cards, invite, nothing };
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {paneMode(layout) === 'split' ? <TodaySplit {...parts} /> : <TodayStack {...parts} />}
    </View>
  );
}

/**
 * One column (phones, small tablets): the list as it has always been, pulled by the door. The door
 * runs edge to edge; every row, heading and empty state keeps to the column (`useOneColumn`), as
 * the door is the list's header and the list's own padding would take it in too.
 */
function TodayStack({ screen, door, quickAdd, sections, cards, invite, nothing }: TodayParts) {
  const { space } = useTheme();
  const listStyle = { paddingBottom: useListEndPadding() };
  const column = useOneColumn();
  const { today, userId, members, tasksQuery } = screen;
  return (
    <FridgeRefresh refreshing={screen.pulling} onRefresh={() => void screen.refresh()}>
      <SectionList
        keyboardShouldPersistTaps="handled"
        sections={sections}
        keyExtractor={taskRowKey}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            {door}
            <View style={[column, { paddingTop: space(4) }]}>{quickAdd}</View>
          </>
        }
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
        renderItem={({ item, index, section }) => (
          <View style={column}>
            <TaskRow
              row={item}
              first={index === 0 && section === sections[0]}
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
function TodaySplit({ screen, door, quickAdd, sections, cards, invite, nothing }: TodayParts) {
  const { colors, space } = useTheme();
  const listStyle = { paddingBottom: useListEndPadding() };
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
      keyboardShouldPersistTaps="handled"
      header={door}
      leftTestID="today.pane.pending"
      rightTestID="today.pane.done"
      refreshControl={refreshControl}
      contentContainerStyle={listStyle}
      left={
        <>
          {quickAdd}
          {left.length > 0 ? (
            <TaskSections sections={left} {...rows} />
          ) : (
            <View style={{ paddingTop: space(6) }}>
              <TaskListStates query={screen.tasksQuery} empty={nothing} />
            </View>
          )}
        </>
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
