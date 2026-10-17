import { type ComponentProps } from 'react';
import { FlatList, View } from 'react-native';
import type { TaskListSection } from '@/features/tasks/sections';
import { SectionHeader } from './SectionHeader';
import { TaskRow, TaskRowSeparator, taskRowKey } from './TaskRow';

type Props = Omit<ComponentProps<typeof TaskRow>, 'row' | 'flush'> & {
  sections: TaskListSection[];
};

/**
 * Task sections laid out in a pane's own scroll (two panes), with the same headings, notes and
 * spacing as the virtualised list. Flush: the pane already brings the gutter. Each section is a
 * FlatList that lays out in full (the pane scrolls), keyed by the task.
 */
export function TaskSections({ sections, ...row }: Props) {
  return (
    <View>
      {sections.map((section) => (
        <View key={section.key}>
          <SectionHeader title={section.title} count={section.count} flush />
          <FlatList
            data={section.data}
            scrollEnabled={false}
            keyExtractor={taskRowKey}
            ItemSeparatorComponent={TaskRowSeparator}
            renderItem={({ item }) => <TaskRow row={item} flush {...row} />}
          />
        </View>
      ))}
    </View>
  );
}
