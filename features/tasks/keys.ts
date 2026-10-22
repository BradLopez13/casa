/** The household's task list in the query cache. */
export const tasksKey = (householdId: string | undefined) => ['tasks', householdId] as const;
