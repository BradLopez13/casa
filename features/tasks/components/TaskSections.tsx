import { Fragment, type ComponentProps } from 'react';
import { View } from 'react-native';
import type { TaskListSection } from '@/features/tasks/sections';
import { SectionHeader } from './SectionHeader';
import { TaskRow, TaskRowSeparator, taskRowKey } from './TaskRow';

type Props = Omit<ComponentProps<typeof TaskRow>, 'row' | 'flush'> & {
  sections: TaskListSection[];
};

/**
 * Task sections laid out in a pane's own scroll (two panes), with the same headings, notes and
 * spacing as the virtualised list. Flush: the pane already brings the gutter. A household's day
 * is short, so plain views are enough here.
 */
export function TaskSections({ sections, ...row }: Props) {
  return (
    <View>
      {sections.map((section) => (
        <View key={section.key}>
          <SectionHeader title={section.title} count={section.count} flush />
          {section.data.map((item, i) => (
            <Fragment key={taskRowKey(item)}>
              {i > 0 ? <TaskRowSeparator /> : null}
              <TaskRow row={item} flush {...row} />
            </Fragment>
          ))}
        </View>
      ))}
    </View>
  );
}
