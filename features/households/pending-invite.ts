import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

const KEY = 'pendingInviteToken';
export const pendingInviteKey = ['pendingInvite'] as const;

export const pendingInvite = {
  async get(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async set(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  },
};

export function usePendingInvite(): {
  token: string | null;
  hasPendingInvite: boolean;
  isLoading: boolean;
} {
  const query = useQuery({ queryKey: pendingInviteKey, queryFn: () => pendingInvite.get() });
  const token = query.data ?? null;
  return { token, hasPendingInvite: token !== null, isLoading: query.isPending };
}

export function useSetPendingInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => pendingInvite.set(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingInviteKey }),
  });
}

export function useClearPendingInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pendingInvite.clear(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingInviteKey }),
  });
}
