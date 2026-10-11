import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { pendingInvite } from '@/features/households/pending-invite';
import { deleteAccount, signOutLocally } from './api';

/**
 * Deletes the account, then drops the local session. No optimistic update: SIGNED_OUT clears
 * the cache and the route guard sends the user to sign-in. `run` ignores a second call that
 * lands before the first has settled (a double tap beats the re-render).
 */
export function useDeleteAccount() {
  const locked = useRef(false);
  const mutation = useMutation({
    mutationFn: async () => {
      await deleteAccount();
      await pendingInvite.clear().catch(() => undefined);
      await signOutLocally();
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  const run = (callbacks: { onError: (e: unknown) => void }) => {
    if (locked.current) return;
    locked.current = true;
    mutation.mutate(undefined, callbacks);
  };
  return { run, isPending: mutation.isPending, reset: mutation.reset };
}
