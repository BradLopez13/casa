import type { PaneMode } from '@/ui/panes';

/** The notes under the door; who you are lives on the door itself. */
export type SettingsGroup = 'households' | 'members' | 'reminders' | 'notices' | 'help' | 'account';

/** The single-column order with several households: «Tus casas» heads it (bloque 12). */
const SEVERAL: readonly SettingsGroup[] = [
  'households',
  'members',
  'reminders',
  'notices',
  'help',
  'account',
];
/**
 * With one household, what is used (Miembros, Invitar) comes first and «Tu casa» after it
 * (decisión 5 de Brad, 27 de octubre).
 */
const ONE: readonly SettingsGroup[] = [
  'members',
  'households',
  'reminders',
  'notices',
  'help',
  'account',
];

/** What the phone does on its own (reminders, household notices), and how the app works. */
const PHONE: ReadonlySet<SettingsGroup> = new Set(['reminders', 'notices', 'help']);

export type SettingsPanes = { left: SettingsGroup[]; right: SettingsGroup[] };

/**
 * Ajustes on two panes: your household and account (members, sign out, delete account) on the
 * left, what the phone tells you (reminders, household notices) and how Nido works on the right. In one column
 * everything stays in its usual order, the account last.
 */
export function settingsPanes(mode: PaneMode, several: boolean): SettingsPanes {
  const order = several ? SEVERAL : ONE;
  if (mode === 'stack') return { left: [...order], right: [] };
  return {
    left: order.filter((group) => !PHONE.has(group)),
    right: order.filter((group) => PHONE.has(group)),
  };
}
