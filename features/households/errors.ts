import { toAppError, type AppErrorCode } from '@/data/supabase/errors';
import { t, type MessageKey } from '@/i18n';

// The household's messages in one place: the members screen, the invitation and onboarding.

const MEMBER_KEYS: Partial<Record<string, MessageKey>> = {
  NOT_AUTHENTICATED: 'members.errors.NOT_AUTHENTICATED',
  OWNER_MUST_TRANSFER: 'members.errors.OWNER_MUST_TRANSFER',
  NOT_OWNER: 'members.errors.NOT_OWNER',
  NOT_A_MEMBER: 'members.errors.NOT_A_MEMBER',
  INVITE_INVALID: 'members.errors.INVITE_INVALID',
  CANNOT_REMOVE_SELF: 'members.errors.CANNOT_REMOVE_SELF',
  LICENSE_REQUIRED: 'errors.LICENSE_REQUIRED',
  NETWORK: 'members.errors.NETWORK',
};

/**
 * A members screen failure. selfDirected: the action is about the current user (invite, leave,
 * delete...), so a NOT_A_MEMBER means "you are no longer in this household", not "that person
 * left".
 */
export function memberErrorMessage(error: unknown, selfDirected = false): string {
  const code = toAppError(error).code;
  if (selfDirected && code === 'NOT_A_MEMBER') return t('members.errors.SELF_NOT_A_MEMBER');
  return t(MEMBER_KEYS[code] ?? 'members.errors.UNKNOWN');
}

const INVITE_KEYS: Partial<Record<AppErrorCode, MessageKey>> = {
  INVITE_INVALID: 'invite.errors.INVITE_INVALID',
  INVITE_EXPIRED: 'invite.errors.INVITE_EXPIRED',
  ALREADY_IN_HOUSEHOLD: 'invite.errors.ALREADY_IN_HOUSEHOLD',
  ALREADY_A_MEMBER: 'invite.errors.ALREADY_A_MEMBER',
  NETWORK: 'invite.errors.NETWORK',
};

/** An invitation that cannot be previewed or accepted. */
export function inviteErrorKey(code: AppErrorCode): MessageKey {
  return INVITE_KEYS[code] ?? 'invite.errors.UNKNOWN';
}

const ONBOARDING_KEYS: Partial<Record<AppErrorCode, MessageKey>> = {
  INVALID_NAME: 'onboarding.errors.nameInvalid',
  INVALID_ROOM: 'errors.INVALID_ROOM',
  ALREADY_IN_HOUSEHOLD: 'onboarding.errors.ALREADY_IN_HOUSEHOLD',
  NETWORK: 'onboarding.errors.NETWORK',
};

/** Creating a household or choosing its rooms. */
export function onboardingErrorMessage(code: AppErrorCode): string {
  return t(ONBOARDING_KEYS[code] ?? 'onboarding.errors.UNKNOWN');
}
