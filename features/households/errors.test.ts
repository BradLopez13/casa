import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { t } from '@/i18n';
import { inviteErrorKey, memberErrorMessage, onboardingErrorMessage } from './errors';

describe('memberErrorMessage', () => {
  it('maps the members codes', () => {
    expect(memberErrorMessage(new AppError('NOT_OWNER'))).toBe(t('members.errors.NOT_OWNER'));
    expect(memberErrorMessage(new AppError('NETWORK'))).toBe(t('members.errors.NETWORK'));
  });
  it('reads NOT_A_MEMBER as "you left" when the action is about the user', () => {
    expect(memberErrorMessage(new AppError('NOT_A_MEMBER'))).toBe(t('members.errors.NOT_A_MEMBER'));
    expect(memberErrorMessage(new AppError('NOT_A_MEMBER'), true)).toBe(
      t('members.errors.SELF_NOT_A_MEMBER'),
    );
  });
  it('falls back to UNKNOWN', () => {
    expect(memberErrorMessage(new AppError('TASK_NOT_FOUND'))).toBe(t('members.errors.UNKNOWN'));
    expect(memberErrorMessage(new Error('x'))).toBe(t('members.errors.UNKNOWN'));
  });
});

describe('inviteErrorKey', () => {
  it('maps the invite codes and falls back to UNKNOWN', () => {
    expect(inviteErrorKey('INVITE_EXPIRED')).toBe('invite.errors.INVITE_EXPIRED');
    expect(inviteErrorKey('ALREADY_IN_HOUSEHOLD')).toBe('invite.errors.ALREADY_IN_HOUSEHOLD');
    expect(inviteErrorKey('NETWORK')).toBe('invite.errors.NETWORK');
    expect(inviteErrorKey('NOT_OWNER')).toBe('invite.errors.UNKNOWN');
  });
});

describe('onboardingErrorMessage', () => {
  it('maps the onboarding codes and falls back to UNKNOWN', () => {
    expect(onboardingErrorMessage('INVALID_NAME')).toBe(t('onboarding.errors.nameInvalid'));
    expect(onboardingErrorMessage('INVALID_ROOM')).toBe(t('errors.INVALID_ROOM'));
    expect(onboardingErrorMessage('NETWORK')).toBe(t('onboarding.errors.NETWORK'));
    expect(onboardingErrorMessage('NOT_OWNER')).toBe(t('onboarding.errors.UNKNOWN'));
  });
});
