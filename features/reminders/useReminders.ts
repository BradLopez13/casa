import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { scheduleReminders } from '@/domain/reminders/schedule';
import type { ReminderSettings } from '@/domain/reminders/settings';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembership } from '@/features/households/queries';
import { useTasks } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { cancelAll, getPermission, replaceScheduled } from './notifications';
import { reminderPlan, reminderText } from './plan';
import { loadReminderSettings, saveReminderSettings } from './storage';

/** Groups bursts of changes (a refetch, several edits) into one reschedule. */
const DEBOUNCE_MS = 1000;
/** Today plus the next seven days. */
const DAYS = 8;

const settingsKey = (userId: string | null) => ['reminder-settings', userId] as const;

/** The signed-in user's reminder settings, read from the device. */
export function useReminderSettings(userId: string | null) {
  return useQuery({
    queryKey: settingsKey(userId),
    queryFn: () => loadReminderSettings(userId as string),
    enabled: userId !== null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Saves the settings; the cache updates first, so the switch and the schedule follow at once. */
export function useSaveReminderSettings(userId: string | null) {
  const client = useQueryClient();
  return useCallback(
    (next: ReminderSettings) => {
      if (userId === null) return;
      client.setQueryData(settingsKey(userId), next);
      // A failed write keeps the in-memory value for this session; nothing to tell the user.
      saveReminderSettings(userId, next).catch(() => undefined);
    },
    [client, userId],
  );
}

/** Bumps each time the app returns to the foreground. */
function useForegroundTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);
  return tick;
}

/**
 * Keeps the phone's scheduled reminders in line with the cached tasks and the settings.
 * Off, no permission, signed out or no household → only cancels. Never asks for permission.
 */
export function useReminders(): void {
  const session = useSession();
  const userId = session.status === 'signed-in' ? session.userId : null;
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const tasks = useTasks(householdId).data;
  const settings = useReminderSettings(userId).data;
  const today = useToday();
  const foreground = useForegroundTick();

  // Whatever happens next, a signed-out phone (or another account) never keeps the previous
  // user's reminders: leaving this user always cancels.
  useEffect(() => {
    if (userId === null) {
      cancelAll().catch(() => undefined);
      return;
    }
    return () => {
      cancelAll().catch(() => undefined);
    };
  }, [userId]);

  useEffect(() => {
    if (userId === null) return;
    // Left the household: nothing to remind about.
    if (membership === null) {
      cancelAll().catch(() => undefined);
      return;
    }
    // Still loading (or offline without a cache): keep what is scheduled.
    if (householdId === undefined || tasks === undefined || settings === undefined) return;

    let stale = false;
    const run = async () => {
      const permission = await getPermission();
      if (stale) return;
      const plan = reminderPlan({ signedIn: true, hasHousehold: true, permission, settings });
      if (plan === 'cancel') {
        await cancelAll();
        return;
      }
      const reminders = scheduleReminders({
        tasks,
        userId,
        today,
        now: new Date(),
        settings,
        days: DAYS,
      });
      await replaceScheduled(reminders.map(reminderText));
    };
    const timer = setTimeout(() => {
      // Errors are ignored: the next change or foreground tries again.
      run().catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [userId, membership, householdId, tasks, settings, today, foreground]);
}
