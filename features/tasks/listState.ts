export type TaskListState = 'loading' | 'error' | 'empty';

/**
 * What an empty task list shows. A refresh over cached tasks that failed for lack of network is
 * not an error here: the offline band under the door says it, and the list keeps its empty state.
 */
export function taskListState(q: {
  isPending: boolean;
  isError: boolean;
  hasData: boolean;
  errorIsNetwork: boolean;
}): TaskListState {
  if (q.isPending) return 'loading';
  if (q.isError && !(q.hasData && q.errorIsNetwork)) return 'error';
  return 'empty';
}
