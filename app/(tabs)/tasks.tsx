import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { weekStrip } from '@/domain/tasks/strip';
import { selectWeek } from '@/domain/tasks/views';
import { weekLine } from '@/domain/tasks/weekLine';
import { DayStrip } from '@/features/tasks/components/DayStrip';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { ModeSwitch, type TasksMode } from '@/features/tasks/components/ModeSwitch';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { TaskRow, TaskRowSeparator, taskRowKey } from '@/features/tasks/components/TaskRow';
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
import { DoorControls, DoorHeader, useDoor } from '@/ui/components/DoorHeader';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { SymbolPlate } from '@/ui/components/SymbolPlate';
import { FridgeRefresh } from '@/ui/components/FridgeRefresh';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useOneColumn } from '@/ui/useOneColumn';
import { useListEndPadding } from '@/ui/useTabBarClearance';

import {
  DayQuickAdd,
  EmptyDay,
  IdeasButton,
  type TasksParts,
} from '@/features/tasks/components/TaskScreenPieces';
import { TasksSplit } from '@/features/tasks/components/TasksSplit';

/** Wait for the rows near the target to render before trying the scroll again. */
const SCROLL_RETRY_MS = 100;

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
  // A full door stacks the filter over the mode, so five people fit without a cut; a compact one
  // (a phone on its side) has the width for both in one row, and holds the quick add.
  const { compact, holdsQuickAdd } = useDoor();
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
        quickAdd={<DayQuickAdd screen={screen} day={mode === 'week' ? day : today} />}
      >
        <DoorControls row={compact}>
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
                {holdsQuickAdd ? null : <DayQuickAdd screen={screen} day={day} />}
                {sections.length > 0 && weekDayPane(sections, day, today).day.count === 0 ? (
                  <View style={{ paddingTop: holdsQuickAdd ? 0 : space(4) }}>
                    <EmptyDay day={day} today={today} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[column, { paddingTop: space(4), gap: space(2) }]}>
                {holdsQuickAdd ? null : <DayQuickAdd screen={screen} day={today} />}
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
        renderItem={({ item, index, section }) => (
          <View style={column}>
            <TaskRow
              row={item}
              first={index === 0 && section === sections[0]}
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
