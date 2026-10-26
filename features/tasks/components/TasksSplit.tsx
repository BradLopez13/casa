import { View } from 'react-native';
import { DayList } from '@/features/tasks/components/DayList';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { TaskSections } from '@/features/tasks/components/TaskSections';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { t } from '@/i18n';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { TwoPane } from '@/ui/components/TwoPane';
import { useTheme } from '@/ui/theme';
import { useListEndPadding } from '@/ui/useTabBarClearance';

import { DayQuickAdd, EmptyDay, IdeasButton, type TasksParts } from './TaskScreenPieces';

/**
 * Wide screens: a fixed door as Hoy's (the filter alone), «Todas» and the seven days stacked on
 * the left, and what the chosen pill holds on the right. The door is outside any scroll, so the
 * left pane takes the pull-to-refresh.
 */
export function TasksSplit({
  screen,
  strip,
  sections,
  day,
  chooseDay,
  empty,
  doorLine,
}: TasksParts) {
  const { space } = useTheme();
  const listStyle = { paddingBottom: useListEndPadding() };
  const refreshControl = usePaneRefreshControl(screen.pulling, () => void screen.refresh());
  const rows = {
    today: screen.today,
    marks: screen.marks,
    names: screen.names,
    userId: screen.userId,
    isBusy: screen.isBusy,
    toggle: screen.toggle,
  };
  const door = (
    <>
      <DoorHeader eyebrow={t('tasks.title')} heading={t('tasks.allHeadline')} secondary={doorLine}>
        <MemberFilter
          members={screen.members}
          marks={screen.marks}
          userId={screen.userId}
          selected={screen.assigneeId}
          onSelect={screen.selectFilter}
        />
      </DoorHeader>
      {screen.showStaleBand ? (
        <OfflineBand label={t('offline.showingLast')} testID="tasks.offline" />
      ) : null}
    </>
  );

  return (
    <TwoPane
      keyboardShouldPersistTaps="handled"
      header={door}
      leftTestID="tasks.pane.days"
      rightTestID="tasks.pane.day"
      // A list beside its detail: the days keep a narrow column, the chosen pill takes the room.
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
          <DayQuickAdd screen={screen} day={day} hasNotes={sections.length > 0} />
          {sections.length > 0 ? (
            <>
              <TaskSections sections={sections} {...rows} />
              {day === null ? (
                <View style={{ paddingTop: space(6) }}>
                  <IdeasButton />
                </View>
              ) : null}
            </>
          ) : (
            <View style={{ paddingTop: space(day === null ? 6 : 4) }}>
              <TaskListStates
                query={screen.tasksQuery}
                empty={
                  day === null ? (
                    <View style={{ gap: space(6), alignItems: 'flex-start' }}>
                      {empty}
                      <IdeasButton />
                    </View>
                  ) : (
                    <EmptyDay day={day} today={screen.today} />
                  )
                }
              />
            </View>
          )}
        </>
      }
    />
  );
}
