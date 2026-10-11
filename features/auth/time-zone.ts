import { supabase } from '@/data/supabase/client';
import { toAppError } from '@/data/supabase/errors';

/** The stored IANA time zone of the signed-in user, or null when none is set yet. */
export async function fetchOwnTimeZone(userId: string): Promise<string | null> {
  let result;
  try {
    result = await supabase
      .from('profiles')
      .select('time_zone')
      .eq('user_id', userId)
      .maybeSingle();
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
  return result.data?.time_zone ?? null;
}

export async function setTimeZone(tz: string): Promise<void> {
  let result;
  try {
    result = await supabase.rpc('set_time_zone', { p_tz: tz });
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
}
