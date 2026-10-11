import { supabase } from '@/data/supabase/client';
import { toAppError } from '@/data/supabase/errors';

export type NotificationPrefs = { taskAssigned: boolean; memberJoined: boolean };

type Outcome = { error: unknown };

/** Throws an AppError when the call failed or the request itself threw. */
async function check(promise: PromiseLike<Outcome>): Promise<void> {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
}

export async function registerPushToken(token: string, platform: 'android' | 'ios'): Promise<void> {
  await check(supabase.rpc('register_push_token', { p_token: token, p_platform: platform }));
}

export async function unregisterPushToken(token: string): Promise<void> {
  await check(supabase.rpc('unregister_push_token', { p_token: token }));
}

/** The stored preferences of the signed-in user; with no row yet, everything is on. */
export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  let result;
  try {
    result = await supabase
      .from('notification_prefs')
      .select('task_assigned, member_joined')
      .eq('user_id', userId)
      .maybeSingle();
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
  return {
    taskAssigned: result.data?.task_assigned ?? true,
    memberJoined: result.data?.member_joined ?? true,
  };
}

export async function setNotificationPrefs(p: NotificationPrefs): Promise<void> {
  await check(
    supabase.rpc('set_notification_prefs', {
      p_task_assigned: p.taskAssigned,
      p_member_joined: p.memberJoined,
    }),
  );
}
