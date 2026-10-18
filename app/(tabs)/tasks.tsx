import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, SectionList, Text, View } from 'react-native';
import { addDays } from '@/domain/tasks/dates';
import { dayInSentence } from '@/domain/tasks/labels';
import { weekStrip, type StripDay } from '@/domain/tasks/strip';
import { selectWeek } from '@/domain/tasks/views';
import { weekLine } from '@/domain/tasks/weekLine';
import { DayList } from '@/features/tasks/components/DayList';
import { DayStrip } from '@/features/tasks/components/DayStrip';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { ModeSwitch, type TasksMode } from '@/features/tasks/components/ModeSwitch';
import { QuickAdd } from '@/features/tasks/components/QuickAdd';
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
import { weekLineText } from '@/features/tasks/weekLineText';
import { chosenDay, weekDayPane } from '@/features/tasks/weekPanes';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { DoorControls, DoorHeader } from '@/ui/components/DoorHeader';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { SymbolPlate } from '@/ui/components/SymbolPlate';
import { FridgeRefresh, usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useOneColumn } from '@/ui/useOneColumn';
import { useListEndPadding } from '@/ui/useTabBarClearance';

/** The field for the chosen day: Hoy and Mañana read as words, any other day as its name. */
function DayQuickAdd({ screen, day }: { screen: Screen; day: string }) {
  const { today, userId, membership } = screen;
  const placeholder =
    day === today
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
    />
  );
}

/**
 * A chosen day with nothing on it says so by name, and offers the full form for that day. Hoy and
 * Mañana keep the plain line: «Nada el hoy» would not read.
 */
function EmptyDay({ day, today }: { day: string; today: string }) {
  const { colors, space } = useTheme();
  const router = useRouter();
  const named = day !== today && day !== addDays(today, 1);
  return (
    <View style={{ gap: space(1), alignItems: 'flex-start' }}>
      <Text style={{ color: colors.muted, fontSize: 16 }}>
        {named ? t('tasks.dayEmptyNamed', { day: dayInSentence(day, today) }) : t('tasks.dayEmpty')}
      </Text>
      <Button
        testID="tasks.add-for-day"
        title={t('tasks.addForDay')}
        variant="tertiary"
        width="hug"
        onPress={() => router.push({ pathname: '/task/new', params: { due: day } })}
      />
    </View>
  );
}

/** Todas offers the catalogue of typical chores the household does not have yet. */
function IdeasButton() {
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
  /** The door's line under its headline: what is yours (or the household's) this week. */
  doorLine: string;
};

export default function TasksScreen() {
  const { colors, space } = useTheme();
  const layout = useLayout();
  const screen = useTaskScreen();
  const { today, members, filtered, userId, assigneeId, tasksQuery } = screen;
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

  // The door counts the whole household, like Hoy's, so it can say what is left for everyone.
  const tasks = tasksQuery.data;
  const filterName = members.find((m) => m.userId === assigneeId)?.displayName ?? '';
  const doorLine = useMemo(
    () =>
      weekLineText(weekLine({ tasks: tasks ?? [], today, userId, filter: assigneeId, filterName })),
    [tasks, today, userId, assigneeId, filterName],
  );

  const sections = useMemo(
    () => (mode === 'week' ? weekSections(week, today) : allSections(filtered, today)),
    [mode, week, filtered, today],
  );

  const empty = (
    <View style={{ gap: space(3), alignItems: 'flex-start' }}>
      <SymbolPlate />
      <Text style={{ color: colors.muted, fontSize: 16 }}>
        {/* Semana can be empty while Todas still has undated, later or done tasks. */}
        {t(mode === 'week' && filtered.length > 0 ? 'tasks.weekEmpty' : 'tasks.empty')}
      </Text>
    </View>
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
    doorLine,
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {paneMode(layout) === 'split' ? <TasksSplit {...parts} /> : <TasksStack {...parts} />}
    </View>
  );
}

/** One column (phones, small tablets): the door with the day strip, and one list under it. */
function TasksStack({
  screen,
  mode,
  setMode,
  strip,
  sections,
  day,
  chooseDay,
  empty,
  doorLine,
}: TasksParts) {
  const { space } = useTheme();
  const listStyle = { paddingBottom: useListEndPadding() };
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
    // The strip is its own row under the title and the controls; in a compact door it runs the
    // full width as one line of days, so the door stays within its 40 % of the window.
    <>
      <DoorHeader
        eyebrow={t('tasks.title')}
        heading={t(mode === 'week' ? 'tasks.weekHeadline' : 'tasks.allHeadline')}
        secondary={doorLine}
        below={
          mode === 'week' ? (
            <DayStrip
              days={strip}
              today={today}
              chosen={day}
              marks={marks}
              names={screen.names}
              onSelect={scrollToDay}
            />
          ) : null
        }
      >
        <DoorControls row>
          <MemberFilter
            dense
            members={members}
            marks={marks}
            userId={userId}
            selected={assigneeId}
            onSelect={screen.selectFilter}
          />
          <ModeSwitch value={mode} onChange={setMode} />
        </DoorControls>
      </DoorHeader>
      {screen.showStaleBand ? (
        <OfflineBand label={t('offline.showingLast')} testID="tasks.offline" />
      ) : null}
    </>
  );

  return (
    <FridgeRefresh refreshing={screen.pulling} onRefresh={() => void screen.refresh()}>
      <SectionList
        keyboardShouldPersistTaps="handled"
        ref={listRef}
        sections={sections}
        keyExtractor={taskRowKey}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            {door}
            {mode === 'week' ? (
              <View style={[column, { paddingTop: space(4) }]}>
                <DayQuickAdd screen={screen} day={day} />
                {sections.length > 0 && weekDayPane(sections, day, today).day.count === 0 ? (
                  <View style={{ paddingTop: space(4) }}>
                    <EmptyDay day={day} today={today} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[column, { paddingTop: space(4), gap: space(2) }]}>
                <DayQuickAdd screen={screen} day={today} />
                <IdeasButton />
              </View>
            )}
          </>
        }
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
 * Wide screens: a fixed door with the filter and the mode (no strip: the days have a pane of
 * their own). Semana puts the seven days on the left and the chosen day on the right; Todas is
 * one centred column. The door is outside any scroll, so the left pane (or the column) takes the
 * pull-to-refresh.
 */
function TasksSplit(parts: TasksParts) {
  const { screen, mode, setMode } = parts;
  const door = (
    <>
      <DoorHeader
        eyebrow={t('tasks.title')}
        heading={t(mode === 'week' ? 'tasks.weekHeadline' : 'tasks.allHeadline')}
        secondary={parts.doorLine}
      >
        <DoorControls row>
          <MemberFilter
            dense
            members={screen.members}
            marks={screen.marks}
            userId={screen.userId}
            selected={screen.assigneeId}
            onSelect={screen.selectFilter}
          />
          <ModeSwitch value={mode} onChange={setMode} />
        </DoorControls>
      </DoorHeader>
      {screen.showStaleBand ? (
        <OfflineBand label={t('offline.showingLast')} testID="tasks.offline" />
      ) : null}
    </>
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
  const { space } = useTheme();
  const listStyle = { paddingBottom: useListEndPadding() };
  const refreshControl = usePaneRefreshControl(screen.pulling, () => void screen.refresh());
  const pane = weekDayPane(sections, day, screen.today);

  return (
    <TwoPane
      keyboardShouldPersistTaps="handled"
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
            names={screen.names}
          />
        </View>
      }
      right={
        <>
          <DayQuickAdd screen={screen} day={day} />
          {sections.length > 0 ? (
            <>
              <TaskSections
                sections={pane.overdue ? [pane.overdue, pane.day] : [pane.day]}
                {...rowProps(screen)}
              />
              {pane.day.count === 0 ? <EmptyDay day={day} today={screen.today} /> : null}
            </>
          ) : (
            <View style={{ paddingTop: space(6) }}>
              <TaskListStates query={screen.tasksQuery} empty={empty} />
            </View>
          )}
        </>
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
  const listStyle = { paddingBottom: useListEndPadding() };
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
          <View style={{ paddingTop: space(4), gap: space(2) }}>
            <DayQuickAdd screen={screen} day={screen.today} />
            <IdeasButton />
          </View>
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
