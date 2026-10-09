import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, Text, View, type TextStyle } from 'react-native';
import { longDateLabel } from '@/domain/tasks/labels';
import { tallyToday } from '@/domain/tasks/tally';
import { MemberFilter } from '@/features/tasks/components/MemberFilter';
import { NewTaskButton } from '@/features/tasks/components/NewTaskButton';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { TallyView } from '@/features/tasks/components/Tally';
import { TemplatesCard } from '@/features/tasks/components/TemplatesCard';
import {
  TaskRow,
  TaskRowSeparator,
  taskListContentStyle,
  taskRowKey,
} from '@/features/tasks/components/TaskRow';
import { scopeLabel } from '@/features/tasks/scope';
import { todaySections } from '@/features/tasks/sections';
import { TaskListStates } from '@/features/tasks/TaskListStates';
import { useTaskScreen } from '@/features/tasks/useTaskScreen';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { FridgeRefresh } from '@/ui/components/FridgeRefresh';
import { useTheme } from '@/ui/theme';

export default function TodayScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const screen = useTaskScreen();
  const { today, userId, membership, members, tasksQuery, assigneeId, filtered } = screen;
  const subtitleStyle: TextStyle = {
    color: colors.muted,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  };

  const tally = useMemo(() => tallyToday(filtered, today), [filtered, today]);
  const sections = useMemo(() => todaySections(filtered, today), [filtered, today]);

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
          marks={screen.marks}
          userId={userId}
          selected={assigneeId}
          onToggle={screen.toggleFilter}
        />
        <TallyView tally={tally} scope={scopeLabel(assigneeId, userId, members)} />
      </View>
    </DoorHeader>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <FridgeRefresh refreshing={screen.pulling} onRefresh={() => void screen.refresh()}>
        <SectionList
          sections={sections}
          keyExtractor={taskRowKey}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={door}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: space(5), paddingTop: space(6), gap: space(6) }}>
              {/* Only a household with no tasks at all, whatever the filter, gets the templates. */}
              {tasksQuery.isSuccess && tasksQuery.data.length === 0 ? <TemplatesCard /> : null}
              <TaskListStates query={tasksQuery} empty={empty} />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.count} />
          )}
          renderItem={({ item }) => (
            <TaskRow
              row={item}
              today={today}
              marks={screen.marks}
              names={screen.names}
              userId={userId}
              isBusy={screen.isBusy}
              toggle={screen.toggle}
            />
          )}
          ItemSeparatorComponent={TaskRowSeparator}
          contentContainerStyle={taskListContentStyle}
        />
      </FridgeRefresh>
      <NewTaskButton testID="today.new-task" assigneeId={assigneeId} />
    </View>
  );
}
