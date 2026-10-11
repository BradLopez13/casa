import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/data/supabase/errors';
import { fetchNotificationPrefs, setNotificationPrefs, type NotificationPrefs } from './api';

const prefsKey = (userId: string | null) => ['notification-prefs', userId] as const;

/** The signed-in user's notice preferences (everything on until they change something). */
export function useNotificationPrefs(userId: string | null) {
  return useQuery({
    queryKey: prefsKey(userId),
    queryFn: () => fetchNotificationPrefs(userId as string),
    enabled: userId !== null,
  });
}

/** Saves both preferences; no optimism, the cache is refetched when it finishes. */
export function useSetNotificationPrefs() {
  const client = useQueryClient();
  return useMutation<void, AppError, NotificationPrefs>({
    mutationFn: setNotificationPrefs,
    onSettled: () => client.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });
}
