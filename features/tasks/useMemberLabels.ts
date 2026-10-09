import { useMemo } from 'react';
import { memberMarks, type MemberMark } from '@/domain/members/marks';
import type { Member } from '@/features/households/api';
import { t } from '@/i18n';

/** Each member's magnet and the name a task list shows for them ("Tú" for the current user). */
export function useMemberLabels(
  members: Member[],
  userId: string | null,
): { marks: Map<string, MemberMark>; names: Map<string, string> } {
  const marks = useMemo(() => memberMarks(members), [members]);
  const names = useMemo(
    () =>
      new Map(
        members.map((m) => [m.userId, m.userId === userId ? t('members.youName') : m.displayName]),
      ),
    [members, userId],
  );
  return { marks, names };
}
