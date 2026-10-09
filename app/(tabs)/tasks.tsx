import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { weekStrip } from '@/domain/tasks/strip';
import { selectWeek } from '@/domain/tasks/views';
import { DayStrip } from '@/features/tasks/components/DayStrip';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { ModeSwitch, type TasksMode } from '@/features/tasks/components/ModeSwitch';
import { NewTaskButton } from '@/features/tasks/components/NewTaskButton';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import {
  TaskRow,
  TaskRowSeparator,
  taskListContentStyle,
  taskRowKey,
} from '@/features/tasks/components/TaskRow';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { sectionIndexFor } from '@/features/tasks/sectionTarget';
import {
  allSections,
  weekSections,
  type TaskListRow,
  type TaskListSection,
} from '@/features/tasks/sections';
import { useTaskScreen } from '@/features/tasks/useTaskScreen';
import { t } from '@/i18n';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { FridgeRefresh } from '@/ui/components/FridgeRefresh';
import { useTheme } from '@/ui/theme';

/** Wait for the rows near the target to render before trying the scroll again. */
const SCROLL_RETRY_MS = 100;

export default function TasksScreen() {
  const { colors, space } = useTheme();
  const screen = useTaskScreen();
  const { today, userId, members, tasksQuery, assigneeId, filtered, marks } = screen;
  const [mode, setMode] = useState<TasksMode>('week');
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

  const sections = useMemo(
    () => (mode === 'week' ? weekSections(week, today) : allSections(filtered, today)),
    [mode, week, filtered, today],
  );

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const scrollToDay = (date: string) => {
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
      <View style={{ gap: space(4) }}>
        <MemberFilter
          members={members}
          marks={marks}
          userId={userId}
          selected={assigneeId}
          onToggle={screen.toggleFilter}
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
      <FridgeRefresh refreshing={screen.pulling} onRefresh={() => void screen.refresh()}>
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={taskRowKey}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={door}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: space(5), paddingTop: space(6) }}>
              <TaskListStates
                query={tasksQuery}
                empty={
                  <Text style={{ color: colors.muted, fontSize: 16 }}>
                    {/* Semana can be empty while Todas still has undated, later or done tasks. */}
                    {t(mode === 'week' && filtered.length > 0 ? 'tasks.weekEmpty' : 'tasks.empty')}
                  </Text>
                }
              />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.count} />
          )}
          renderItem={({ item }) => (
            <TaskRow
              row={item}
              today={today}
              marks={marks}
              names={screen.names}
              userId={userId}
              isBusy={screen.isBusy}
              toggle={screen.toggle}
            />
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
          contentContainerStyle={taskListContentStyle}
        />
      </FridgeRefresh>
      <NewTaskButton testID="tasks.new-task" assigneeId={assigneeId} />
    </View>
  );
}
