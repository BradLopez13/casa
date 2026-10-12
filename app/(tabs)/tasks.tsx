import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ScrollView, SectionList, Text, View } from 'react-native';
import { weekStrip, type StripDay } from '@/domain/tasks/strip';
import { selectWeek } from '@/domain/tasks/views';
import { DayList } from '@/features/tasks/components/DayList';
import { DayStrip } from '@/features/tasks/components/DayStrip';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { ModeSwitch, type TasksMode } from '@/features/tasks/components/ModeSwitch';
import { NewTaskButton, useNewTaskListStyle } from '@/features/tasks/components/NewTaskButton';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { TaskRow, TaskRowSeparator, taskRowKey } from '@/features/tasks/components/TaskRow';
import { TaskSections } from '@/features/tasks/components/TaskSections';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { sectionIndexFor } from '@/features/tasks/sectionTarget';
import {
  allSections,
  weekSections,
  type TaskListRow,
  type TaskListSection,
} from '@/features/tasks/sections';
import { useTaskScreen } from '@/features/tasks/useTaskScreen';
import { chosenDay, weekDayPane } from '@/features/tasks/weekPanes';
import { t } from '@/i18n';
import { DoorControls, DoorHeader, useDoorCompact } from '@/ui/components/DoorHeader';
import { FridgeRefresh, usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useOneColumn } from '@/ui/useOneColumn';

/** Wait for the rows near the target to render before trying the scroll again. */
const SCROLL_RETRY_MS = 100;

type Screen = ReturnType<typeof useTaskScreen>;

/** What both layouts share: the mode, the week, the chosen day and the list pieces. */
type TasksParts = {
  screen: Screen;
  mode: TasksMode;
  setMode: (mode: TasksMode) => void;
  strip: StripDay[];
  sections: TaskListSection[];
  /** The day Semana shows on two panes; held by the screen so a change of layout keeps it. */
  day: string;
  chooseDay: (date: string) => void;
  empty: ReactNode;
};

export default function TasksScreen() {
  const { colors } = useTheme();
  const layout = useLayout();
  const screen = useTaskScreen();
  const { today, members, assigneeId, filtered } = screen;
  const [mode, setMode] = useState<TasksMode>('week');
  // The screen owns the chosen day, not either layout, so turning the tablet keeps it.
  const [chosen, setChosen] = useState<string | null>(null);

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

  const sections = useMemo(
    () => (mode === 'week' ? weekSections(week, today) : allSections(filtered, today)),
    [mode, week, filtered, today],
  );

  const empty = (
    <Text style={{ color: colors.muted, fontSize: 16 }}>
      {/* Semana can be empty while Todas still has undated, later or done tasks. */}
      {t(mode === 'week' && filtered.length > 0 ? 'tasks.weekEmpty' : 'tasks.empty')}
    </Text>
  );

  const parts: TasksParts = {
    screen,
    mode,
    setMode,
    strip,
    sections,
    day: chosenDay(strip, chosen, today),
    chooseDay: setChosen,
    empty,
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {paneMode(layout) === 'split' ? <TasksSplit {...parts} /> : <TasksStack {...parts} />}
      <NewTaskButton testID="tasks.new-task" assigneeId={assigneeId} />
    </View>
  );
}

/** One column (phones, small tablets): the door with the day strip, and one list under it. */
function TasksStack({ screen, mode, setMode, strip, sections, chooseDay, empty }: TasksParts) {
  const { space } = useTheme();
  const listStyle = useNewTaskListStyle();
  const column = useOneColumn();
  const { today, userId, members, tasksQuery, assigneeId, marks } = screen;
  const listRef = useRef<SectionList<TaskListRow, TaskListSection>>(null);
  // The day a strip tap is aiming for, kept for one retry if the first scroll fails.
  const pendingScroll = useRef<string | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by the deferred retry, which must see the list as it is then, not as it was at the tap.
  const modeRef = useRef<TasksMode>(mode);
  const sectionsRef = useRef<TaskListSection[]>([]);

  useEffect(() => {
    modeRef.current = mode;
    // Leaving a mode (or the screen) drops any scroll still aimed at it.
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      pendingScroll.current = null;
    };
  }, [mode]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const scrollToDay = (date: string) => {
    // Remembered even for a day with nothing on it: two panes show it after a turn of the tablet.
    chooseDay(date);
    const sectionIndex = sectionIndexFor(date, sections);
    // A day with nothing on it has no section: the tap does nothing.
    if (sectionIndex === null) return;
    pendingScroll.current = date;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0 });
  };

  const retryScroll = (date: string) => {
    // The list may have changed since the tap: aim again only if that day still has a section.
    if (modeRef.current !== 'week') return;
    const sectionIndex = sectionIndexFor(date, sectionsRef.current);
    if (sectionIndex === null) return;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0 });
  };

  const door = (
    <DoorHeader title={t('tasks.title')} titleSize="medium">
      <StackDoorBody
        controls={
          <DoorControls>
            <MemberFilter
              members={members}
              marks={marks}
              userId={userId}
              selected={assigneeId}
              onToggle={screen.toggleFilter}
            />
            <ModeSwitch value={mode} onChange={setMode} />
          </DoorControls>
        }
        strip={
          mode === 'week' ? (
            <DayStrip days={strip} today={today} marks={marks} onSelect={scrollToDay} />
          ) : null
        }
      />
    </DoorHeader>
  );

  return (
    <FridgeRefresh refreshing={screen.pulling} onRefresh={() => void screen.refresh()}>
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={taskRowKey}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={door}
        ListEmptyComponent={
          <View style={[column, { paddingTop: space(6) }]}>
            <TaskListStates query={tasksQuery} empty={empty} />
          </View>
        }
        // The door is the list's header and runs edge to edge; each heading and row keeps to the
        // column itself.
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
              marks={marks}
              names={screen.names}
              userId={userId}
              isBusy={screen.isBusy}
              toggle={screen.toggle}
              flush
            />
          </View>
        )}
        ItemSeparatorComponent={TaskRowSeparator}
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
            retryScroll(target);
          }, SCROLL_RETRY_MS);
        }}
        contentContainerStyle={listStyle}
      />
    </FridgeRefresh>
  );
}

/**
 * The one-column door's body: the filter and the mode (`DoorControls`, so a compact door puts
 * them side by side beside the title), then the day strip as its own row beneath. A compact door
 * tightens the gap so the whole stays within its 40 % of the window.
 */
function StackDoorBody({ controls, strip }: { controls: ReactNode; strip: ReactNode }) {
  const { space } = useTheme();
  const compact = useDoorCompact();
  return (
    <View style={{ gap: compact ? space(2) : space(4) }}>
      {controls}
      {strip}
    </View>
  );
}

/**
 * Wide screens: a fixed door with the filter and the mode (no strip: the days have a pane of
 * their own). Semana puts the seven days on the left and the chosen day on the right; Todas is
 * one centred column. The door is outside any scroll, so the left pane (or the column) takes the
 * pull-to-refresh.
 */
function TasksSplit(parts: TasksParts) {
  const { screen, mode, setMode } = parts;
  const door = (
    <DoorHeader title={t('tasks.title')} titleSize="medium">
      <DoorControls>
        <MemberFilter
          members={screen.members}
          marks={screen.marks}
          userId={screen.userId}
          selected={screen.assigneeId}
          onToggle={screen.toggleFilter}
        />
        <ModeSwitch value={mode} onChange={setMode} />
      </DoorControls>
    </DoorHeader>
  );
  return mode === 'week' ? (
    <WeekPanes {...parts} door={door} />
  ) : (
    <AllColumn {...parts} door={door} />
  );
}

type SplitProps = TasksParts & { door: ReactElement };

const rowProps = (screen: Screen) => ({
  today: screen.today,
  marks: screen.marks,
  names: screen.names,
  userId: screen.userId,
  isBusy: screen.isBusy,
  toggle: screen.toggle,
});

/** Semana on two panes: the seven days to choose from, and what the chosen one holds. */
function WeekPanes({ screen, strip, sections, day, chooseDay, empty, door }: SplitProps) {
  const { colors, space } = useTheme();
  const listStyle = useNewTaskListStyle();
  const refreshControl = usePaneRefreshControl(screen.pulling, () => void screen.refresh());
  const pane = weekDayPane(sections, day, screen.today);

  return (
    <TwoPane
      header={door}
      leftTestID="tasks.pane.days"
      rightTestID="tasks.pane.day"
      // A list beside its detail: the days keep a narrow column, the chosen day takes the room.
      wide="right"
      refreshControl={refreshControl}
      contentContainerStyle={listStyle}
      left={
        // Level with the first heading on the right.
        <View style={{ paddingTop: space(6) }}>
          <DayList
            days={strip}
            selected={day}
            onSelect={chooseDay}
            today={screen.today}
            marks={screen.marks}
          />
        </View>
      }
      right={
        sections.length > 0 ? (
          <>
            <TaskSections
              sections={pane.overdue ? [pane.overdue, pane.day] : [pane.day]}
              {...rowProps(screen)}
            />
            {pane.day.count === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 16 }}>{t('tasks.dayEmpty')}</Text>
            ) : null}
          </>
        ) : (
          <View style={{ paddingTop: space(6) }}>
            <TaskListStates query={screen.tasksQuery} empty={empty} />
          </View>
        )
      }
    />
  );
}

/**
 * Todas on a wide screen: one column kept to a reading width and centred, under the same fixed
 * door as Semana, so switching modes leaves the door where it is.
 */
function AllColumn({ screen, sections, empty, door }: SplitProps) {
  const { space } = useTheme();
  const column = useOneColumn();
  const listStyle = useNewTaskListStyle();
  const refreshControl = usePaneRefreshControl(screen.pulling, () => void screen.refresh());

  return (
    <View style={{ flex: 1 }}>
      {door}
      <ScrollView
        testID="tasks.pane.all"
        refreshControl={refreshControl}
        contentContainerStyle={listStyle}
      >
        <View style={column}>
          {sections.length > 0 ? (
            <TaskSections sections={sections} {...rowProps(screen)} />
          ) : (
            <View style={{ paddingTop: space(6) }}>
              <TaskListStates query={screen.tasksQuery} empty={empty} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
