import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/data/supabase/errors';
import { getMyMembership, listActiveInvites, listMembers } from './api';

export const membershipKey = ['membership'] as const;
export const membersKey = (householdId: string | undefined) => ['members', householdId] as const;
export const invitesKey = (householdId: string | undefined) => ['invites', householdId] as const;

export function useMembership() {
  return useQuery({ queryKey: membershipKey, queryFn: getMyMembership });
}

export function useMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: membersKey(householdId),
    queryFn: () => listMembers(householdId as string),
    enabled: householdId !== undefined,
  });
}

export function useInvites(householdId: string | undefined) {
  return useQuery({
    queryKey: invitesKey(householdId),
    queryFn: () => listActiveInvites(householdId as string),
    enabled: householdId !== undefined,
  });
}

/** Runs a household RPC and refreshes membership, members and invites on success. */
export function useHouseholdMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, AppError, TArgs>({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: membershipKey }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['invites'] }),
      ]);
    },
  });
}
