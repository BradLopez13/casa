import { type ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { DayList } from '@/features/tasks/components/DayList';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { ModeSwitch } from '@/features/tasks/components/ModeSwitch';
import { TaskSections } from '@/features/tasks/components/TaskSections';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { weekDayPane } from '@/features/tasks/weekPanes';
import { t } from '@/i18n';
import { DoorControls, DoorHeader } from '@/ui/components/DoorHeader';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { TwoPane } from '@/ui/components/TwoPane';
import { useTheme } from '@/ui/theme';
import { useOneColumn } from '@/ui/useOneColumn';
import { useListEndPadding } from '@/ui/useTabBarClearance';

import {
  DayQuickAdd,
  EmptyDay,
  IdeasButton,
  type Screen,
  type TasksParts,
} from './TaskScreenPieces';

/**
 * Wide screens: a fixed door with the filter and the mode (no strip: the days have a pane of
 * their own). Semana puts the seven days on the left and the chosen day on the right; Todas is
 * one centred column. The door is outside any scroll, so the left pane (or the column) takes the
 * pull-to-refresh.
 */
export function TasksSplit(parts: TasksParts) {
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
