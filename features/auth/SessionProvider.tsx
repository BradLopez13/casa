import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { forgetCachedData } from '@/data/query/persist';
import { supabase } from '@/data/supabase/client';

export type SessionState = {
  status: 'loading' | 'signed-out' | 'signed-in';
  userId: string | null;
};

const SessionContext = createContext<SessionState>({ status: 'loading', userId: null });

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading', userId: null });

  useEffect(() => {
    // INITIAL_SESSION is emitted on subscribe, so this also reads the stored session.
    // The callback stays synchronous: no supabase calls inside it.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id ?? null;
      setState((prev) => {
        const status = userId ? 'signed-in' : 'signed-out';
        return prev.status === status && prev.userId === userId ? prev : { status, userId };
      });
      if (event === 'SIGNED_OUT') {
        // Never let the next user see the previous user's cached data, here or on the device.
        forgetCachedData(queryClient);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void queryClient.invalidateQueries({ queryKey: ['membership'] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo(() => state, [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
