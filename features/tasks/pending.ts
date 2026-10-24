import type { QueryClient } from '@tanstack/react-query';
import { localDateIso } from '@/domain/tasks/dates';
import { applyToggle } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { CREATE_KEY, draftItem, type CreateVars } from './create';
import { TOGGLE_KEY, type ToggleVars } from './toggle';

/**
 * The household's tasks as the server sent them, with what is still queued here laid on top, in
 * the order it was done: a note created offline stays, a note ticked off offline stays ticked.
 * Without it, any refetch while the queue waits (a cold start, the connection coming back, the
 * tirador, another member's change) showed the list as if nothing had been done until the queue
 * emptied (fase 10e).
 */
export function withQueued(
  queryClient: QueryClient,
  householdId: string,
  tasks: TaskItem[],
): TaskItem[] {
  const queued = queryClient
    .getMutationCache()
    .findAll({ mutationKey: ['tasks'], status: 'pending' })
    .sort((a, b) => a.mutationId - b.mutationId);
  let out = tasks;
  for (const mutation of queued) {
    const kind = mutation.options.mutationKey?.[1];
    const at = new Date(mutation.state.submittedAt || Date.now());
    if (kind === CREATE_KEY[1]) {
      const vars = mutation.state.variables as CreateVars | undefined;
      if (!vars || vars.householdId !== householdId) continue;
      if (!out.some((task) => task.id === vars.id)) out = [...out, draftItem(vars, at)];
    } else if (kind === TOGGLE_KEY[1]) {
      const vars = mutation.state.variables as ToggleVars | undefined;
      if (!vars || vars.householdId !== householdId) continue;
      const target = out.find((task) => task.id === vars.id);
      // Already as the toggle leaves it (the server got it first): nothing to lay on.
      if (!target || (target.completedAt !== null) === vars.done) continue;
      out = applyToggle(out, vars.id, vars.done, vars.userId, at.toISOString(), localDateIso(at));
    }
  }
  return out;
}
