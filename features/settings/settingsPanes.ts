import type { PaneMode } from '@/ui/panes';

export type SettingsGroup = 'profile' | 'members' | 'reminders' | 'notices' | 'account';

/** The single-column order, as Ajustes has always read. */
const ORDER: readonly SettingsGroup[] = ['profile', 'members', 'reminders', 'notices', 'account'];

/** What the phone does on its own: reminders and household notices. */
const PHONE: ReadonlySet<SettingsGroup> = new Set(['reminders', 'notices']);

export type SettingsPanes = { left: SettingsGroup[]; right: SettingsGroup[] };

/**
 * Ajustes on two panes: who you are and your household (profile, members, sign out, delete
 * account) on the left, what the phone tells you (reminders, household notices) on the right. In
 * one column everything stays in its usual order, the account actions last.
 */
export function settingsPanes(mode: PaneMode): SettingsPanes {
  if (mode === 'stack') return { left: [...ORDER], right: [] };
  return {
    left: ORDER.filter((group) => !PHONE.has(group)),
    right: ORDER.filter((group) => PHONE.has(group)),
  };
}

/**
 * Whether a group opens a new block, with more space above it than inside it. The members button
 * belongs with the profile above it; the first group of a pane needs no extra space.
 */
export function startsBlock(groups: readonly SettingsGroup[], index: number): boolean {
  return index > 0 && groups[index] !== 'members';
}
