import type { PaneMode } from '@/ui/panes';

/** The notes under the door; who you are lives on the door itself. */
export type SettingsGroup = 'members' | 'reminders' | 'notices' | 'help' | 'account';

/** The single-column order, as Ajustes has always read. */
const ORDER: readonly SettingsGroup[] = ['members', 'reminders', 'notices', 'help', 'account'];

/** What the phone does on its own (reminders, household notices), and how the app works. */
const PHONE: ReadonlySet<SettingsGroup> = new Set(['reminders', 'notices', 'help']);

export type SettingsPanes = { left: SettingsGroup[]; right: SettingsGroup[] };

/**
 * Ajustes on two panes: your household and account (members, sign out, delete account) on the
 * left, what the phone tells you (reminders, household notices) and how Nido works on the right. In one column
 * everything stays in its usual order, the account last.
 */
export function settingsPanes(mode: PaneMode): SettingsPanes {
  if (mode === 'stack') return { left: [...ORDER], right: [] };
  return {
    left: ORDER.filter((group) => !PHONE.has(group)),
    right: ORDER.filter((group) => PHONE.has(group)),
  };
}
