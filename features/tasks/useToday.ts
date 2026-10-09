import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateIso } from '@/domain/tasks/dates';

const TICK_MS = 60_000;

/** Today's local date (YYYY-MM-DD). Moves on at midnight and when the app comes back. */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateIso(new Date()));

  useEffect(() => {
    const refresh = () => setToday(localDateIso(new Date()));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, TICK_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  return today;
}
