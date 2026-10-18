import { type ComponentProps } from 'react';
import { SectionList } from 'react-native';
import type { TaskListSection } from '@/features/tasks/sections';
import { SectionHeader } from './SectionHeader';
import { TaskRow, TaskRowSeparator, taskRowKey } from './TaskRow';

type Props = Omit<ComponentProps<typeof TaskRow>, 'row' | 'flush'> & {
  sections: TaskListSection[];
};

/**
 * Task sections for the two-pane layout: ONE SectionList, with the same headings, notes and
 * spacing as the one-column list. Flush: the pane already brings the gutter. The pane is a
 * scroll of its own that also holds other things (the day strip, empty lines), which this
 * screen's panes can't hand to the list, so the list lays out in full (`scrollEnabled={false}`).
 */
export function TaskSections({ sections, ...row }: Props) {
  return (
    <SectionList
      sections={sections}
      scrollEnabled={false}
      keyExtractor={taskRowKey}
      stickySectionHeadersEnabled={false}
      ItemSeparatorComponent={TaskRowSeparator}
      renderSectionHeader={({ section }) => (
        <SectionHeader title={section.title} count={section.count} flush />
      )}
      renderItem={({ item }) => <TaskRow row={item} flush {...row} />}
    />
  );
}
