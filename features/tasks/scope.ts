import { t } from '@/i18n';
import type { Member } from '@/features/households/api';

/** Who the header's numbers and list are about. A filter on someone who left means everyone. */
export function scopeLabel(
  selected: string | null,
  userId: string | null,
  members: Member[],
): string {
  if (selected === null) return t('today.scope.all');
  if (selected === userId) return t('today.scope.mine');
  const person = members.find((m) => m.userId === selected);
  return person ? t('today.scope.person', { name: person.displayName }) : t('today.scope.all');
}
