import { describe, expect, it } from 'vitest';
import type { TaskListSection } from './sections';
import { todayCards, todayPanes } from './todayPanes';

const section = (key: string): TaskListSection => ({ key, title: key, count: 1, data: [] });

describe('todayPanes', () => {
  it('puts overdue and today on the left and the done tray on the right', () => {
    const panes = todayPanes([section('overdue'), section('today'), section('doneToday')]);
    expect(panes.left.map((s) => s.key)).toEqual(['overdue', 'today']);
    expect(panes.right.map((s) => s.key)).toEqual(['doneToday']);
  });

  it('stacks left then right in the single-column order', () => {
    const sections = [section('overdue'), section('today'), section('doneToday')];
    const { left, right } = todayPanes(sections);
    expect([...left, ...right]).toEqual(sections);
  });

  it('leaves a pane empty when its sections are', () => {
    expect(todayPanes([section('doneToday')]).left).toEqual([]);
    expect(todayPanes([section('today')]).right).toEqual([]);
    expect(todayPanes([])).toEqual({ left: [], right: [] });
  });
});

describe('todayCards', () => {
  const base = { loaded: true, taskCount: 3, memberCount: 2, listEmpty: false };

  it('offers nothing to a household with tasks and company', () => {
    expect(todayCards(base)).toEqual({ templates: false, invite: false });
  });

  it('offers the templates only when the household has no tasks at all', () => {
    expect(todayCards({ ...base, taskCount: 0, listEmpty: true }).templates).toBe(true);
    // A filter that hides every task is not an empty household.
    expect(todayCards({ ...base, listEmpty: true }).templates).toBe(false);
  });

  it('invites only a household of one with nothing to list', () => {
    expect(todayCards({ ...base, memberCount: 1, listEmpty: true }).invite).toBe(true);
    expect(todayCards({ ...base, memberCount: 1 }).invite).toBe(false);
  });

  it('offers nothing until the tasks have loaded', () => {
    expect(todayCards({ loaded: false, taskCount: 0, memberCount: 1, listEmpty: true })).toEqual({
      templates: false,
      invite: false,
    });
  });
});
