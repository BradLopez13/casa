import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { weekStrip } from '@/domain/tasks/strip';
import { allLine } from '@/domain/tasks/weekLine';
import { allLineText } from '@/features/tasks/allLineText';
import { chosenPill, daySections } from '@/features/tasks/dayFilter';
import { DayPills } from '@/features/tasks/components/DayPills';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { TaskRow, TaskRowSeparator, taskRowKey } from '@/features/tasks/components/TaskRow';
import { dueParam } from '@/features/tasks/dueParam';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { allSections, type TaskListRow, type TaskListSection } from '@/features/tasks/sections';
import { useTaskScreen } from '@/features/tasks/useTaskScreen';
import { HelpLink } from '@/features/settings/HelpLink';
import { t } from '@/i18n';
import { DoorHeader, useDoor } from '@/ui/components/DoorHeader';
import { LicenseBand } from '@/features/households/LicenseBand';
import { useSeveralHouseholds } from '@/features/households/queries';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { SymbolPlate } from '@/ui/components/SymbolPlate';
import { FridgeRefresh } from '@/ui/components/FridgeRefresh';
import { stripInDoor } from '@/ui/door';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useOneColumn } from '@/ui/useOneColumn';
import { useNoticeNudge } from '@/ui/useNoticeNudge';
import { useListEndPadding } from '@/ui/useTabBarClearance';

import {
  DayQuickAdd,
  EmptyDay,
  IdeasButton,
  type TasksParts,
} from '@/features/tasks/components/TaskScreenPieces';
import { TasksSplit } from '@/features/tasks/components/TasksSplit';

export default function TasksScreen() {
  const { colors, space } = useTheme();
  const layout = useLayout();
  const screen = useTaskScreen();
  const { today, members, filtered, userId, assigneeId, tasksQuery } = screen;
  // A link into Tareas may name a day (`casa://tasks?due=2026-10-23`): it chooses that pill.
  const { due } = useLocalSearchParams<{ due?: string }>();
  // The screen owns the chosen day (null is «Todas»), not either layout, so turning the tablet
  // keeps it.
  const [chosen, setChosen] = useState<string | null>(() =>
    due === undefined ? null : dueParam(due, today),
  );
  // A later link, while the tab is open, chooses again.
  const [seenDue, setSeenDue] = useState(due);
  if (due !== seenDue) {
    setSeenDue(due);
    if (due !== undefined) setChosen(dueParam(due, today));
  }

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
  const day = chosenPill(strip, chosen);

  // The door counts the whole household, like Hoy's, so it can say what is left for everyone.
  const tasks = tasksQuery.data;
  const filterName = members.find((m) => m.userId === assigneeId)?.displayName ?? '';
  const several = useSeveralHouseholds();
  const doorLine = useMemo(
    () =>
      allLineText(
        allLine({ tasks: tasks ?? [], today, userId, filter: assigneeId, filterName }),
        several,
      ),
    [tasks, today, userId, assigneeId, filterName, several],
  );

  const sections = useMemo(
    () => (day === null ? allSections(filtered, today) : daySections(filtered, day, today)),
    [day, filtered, today],
  );

  const empty = (
    <View style={{ gap: space(3), alignItems: 'flex-start' }}>
      <SymbolPlate />
      <Text style={{ color: colors.muted, fontSize: 16 }}>{t('tasks.empty')}</Text>
      <HelpLink entry="write" testID="tasks.help" />
    </View>
  );

  const parts: TasksParts = {
    screen,
    strip,
    sections,
    day,
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

/**
 * One column (phones, small tablets): the door as Hoy's, and one list under it with the quick
 * add and the row of day pills at its head.
 */
function TasksStack({ screen, strip, sections, day, chooseDay, empty, doorLine }: TasksParts) {
  const { space } = useTheme();
  const endPadding = useListEndPadding();
  const column = useOneColumn();
  const doorLook = useDoor();
  const { holdsQuickAdd } = doorLook;
  // In a compact door the pills come in, so only the quick add stands above the first note.
  const pillsInDoor = stripInDoor(doorLook);
  const { today, userId, members, tasksQuery, assigneeId, marks } = screen;
  const pills = (
    <DayPills
      days={strip}
      today={today}
      chosen={day}
      names={screen.names}
      onSelect={chooseDay}
      bleed={pillsInDoor ? 'right' : 'both'}
    />
  );
  const listRef = useRef<SectionList<TaskListRow, TaskListSection>>(null);
  // «Hecha. Deshacer» must not cover the note it speaks of.
  const nudge = useNoticeNudge((y, animated) =>
    listRef.current?.getScrollResponder()?.scrollTo({ y, animated }),
  );

  const door = (
    <>
      <DoorHeader
        eyebrow={t('tasks.title')}
        heading={t('tasks.allHeadline')}
        secondary={doorLine}
        quickAdd={<DayQuickAdd screen={screen} day={day} hasNotes={sections.length > 0} />}
        strip={pills}
      >
        <MemberFilter
          members={members}
          marks={marks}
          userId={userId}
          selected={assigneeId}
          onSelect={screen.selectFilter}
        />
      </DoorHeader>
      {screen.showStaleBand ? (
        <OfflineBand label={t('offline.showingLast')} testID="tasks.offline" />
      ) : null}
      <LicenseBand />
    </>
  );

  return (
    <FridgeRefresh refreshing={screen.pulling} onRefresh={() => void screen.refresh()}>
      <SectionList
        ref={listRef}
        {...nudge.listProps}
        keyboardShouldPersistTaps="handled"
        sections={sections}
        keyExtractor={taskRowKey}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            {/* Measured so the nudge never leaves it cut under the status bar. */}
            <View onLayout={nudge.onDoorLayout}>{door}</View>
            <View style={[column, { paddingTop: space(4), gap: space(3) }]}>
              {/* On a phone on its side the door holds the field. */}
              {holdsQuickAdd ? null : (
                <DayQuickAdd screen={screen} day={day} hasNotes={sections.length > 0} />
              )}
              {/* At large text, upright, the pills are in the door beside the magnets. */}
              {pillsInDoor ? null : pills}
            </View>
          </>
        }
        // The catalogue waits at the end of Todas: a way to find more, not a layer before the
        // first note (at ×1,6 that row was what pushed the first note under the tab bar).
        ListFooterComponent={
          day === null && sections.length > 0 ? (
            <View style={[column, { paddingTop: space(6) }]}>
              <IdeasButton />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={[column, { paddingTop: space(day === null ? 6 : 4) }]}>
            <TaskListStates
              query={tasksQuery}
              empty={
                day === null ? (
                  <View style={{ gap: space(6), alignItems: 'flex-start' }}>
                    {empty}
                    <IdeasButton />
                  </View>
                ) : (
                  <EmptyDay day={day} today={today} />
                )
              }
            />
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
        contentContainerStyle={{ paddingBottom: endPadding + nudge.endPadding }}
      />
    </FridgeRefresh>
  );
}
