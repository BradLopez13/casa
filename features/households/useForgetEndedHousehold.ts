import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { cachedHouseholdIds, endedHouseholdIds } from '@/data/query/ended-household';
import { forgetEndedHousehold } from '@/data/query/persist';
import { t } from '@/i18n';
import { useNotice } from '@/ui/components/Notice';
import { membershipEnd, type Membership } from './api';
import { householdsKey } from './keys';
import { setEndedNotice } from './endedNotice';

type Seen = { householdId: string; householdName: string };

/** The queued changes of `householdId` still waiting: what forgetting the household loses. */
function unsentOf(queryClient: QueryClient, householdId: string): number {
  return queryClient
    .getMutationCache()
    .findAll({ status: 'pending' })
    .filter(
      (m) =>
        (m.state.variables as { householdId?: unknown } | undefined)?.householdId === householdId,
    ).length;
}

/** «Se perdieron 2 cambios que no llegaron a enviarse.», or nothing. */
function lostText(count: number): string {
  if (count === 0) return '';
  return ` ${t(count === 1 ? 'households.ended.lostOne' : 'households.ended.lostOther', { count })}`;
}

/**
 * A membership that ended from someone else's side (removed, the household deleted, left from
 * another phone) must not leave that household's data on the device: once the household list no
 * longer has it, its data and its queue are forgotten. The other households' data stays
 * (bloque 12).
 *
 * If it was the household on screen, the person is told (bloque 15.2, P2-2; the tablet jumped
 * to another household without a word): which one ended, why (`membership_end`, as far as the
 * server knows), where they are now, and how many changes that never got sent were lost. With
 * no other household the sentence waits for the screen with none (`endedNotice`).
 */
export function useForgetEndedHousehold(
  households: readonly Membership[] | undefined,
  membership: Membership | null | undefined,
): void {
  const client = useQueryClient();
  const notify = useNotice();
  // The membership on screen before the list moved it on (fetchHouseholds does, at once).
  const seen = useRef<Seen | null>(null);
  const latest = useRef(membership);
  useEffect(() => {
    latest.current = membership;
  }, [membership]);

  useEffect(() => {
    const ended = endedHouseholdIds(cachedHouseholdIds(client), households);
    for (const id of ended) {
      const was = seen.current;
      const lost = unsentOf(client, id);
      forgetEndedHousehold(client, id);
      if (was === null || was.householdId !== id) continue;
      seen.current = null;
      void membershipEnd(id)
        .then((reason) => reason ?? 'gone')
        .catch(() => 'gone' as const)
        .then((reason) => {
          const next = latest.current;
          const old = was.householdName;
          if (next) {
            notify(
              t(`households.ended.${reason}`, { old, next: next.householdName }) + lostText(lost),
            );
          } else {
            setEndedNotice(t(`households.endedAlone.${reason}`, { old }) + lostText(lost));
          }
        });
    }
  }, [client, households, notify]);

  useEffect(() => {
    if (!membership) return;
    // fetchHouseholds moves the membership on before the list arrives (two renders): while the
    // list the cache holds already lacks the household seen, that one is still the one to name.
    const list = client.getQueryData<readonly Membership[]>(householdsKey);
    const was = seen.current;
    if (was && list && !list.some((h) => h.householdId === was.householdId)) return;
    seen.current = { householdId: membership.householdId, householdName: membership.householdName };
  }, [client, membership]);
}
