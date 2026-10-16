import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthFailure,
  normalizeEmail,
  requestPasswordReset,
  resendSignUpCode,
  resetPassword,
  signIn,
  signUp,
  verifySignUpCode,
} from './api';

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/data/supabase/client', () => ({ supabase: { auth, rpc: vi.fn() } }));
vi.mock('@/data/supabase/errors', () => ({ toAppError: (e: unknown) => e }));
vi.mock('@/features/push/registration', () => ({ forgetPushRegistration: vi.fn() }));

const ok = { data: {}, error: null };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ana@Mail.com ')).toBe('ana@mail.com');
  });
});

describe('verifySignUpCode', () => {
  it('verifies with the normalized email', async () => {
    auth.verifyOtp.mockResolvedValue(ok);
    await verifySignUpCode({ email: ' Ana@Mail.com ', code: '123456' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@mail.com',
      token: '123456',
      type: 'signup',
    });
  });

  it('maps otp_expired to INVALID_CODE', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
    await expect(verifySignUpCode({ email: 'a@b.c', code: '1' })).rejects.toMatchObject({
      code: 'INVALID_CODE',
    });
    await expect(verifySignUpCode({ email: 'a@b.c', code: '1' })).rejects.toBeInstanceOf(
      AuthFailure,
    );
  });
});

describe('resendSignUpCode', () => {
  it('resends a signup code', async () => {
    auth.resend.mockResolvedValue(ok);
    await resendSignUpCode(' Ana@Mail.com');
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@mail.com' });
  });

  it('maps the rate limit to RATE_LIMITED', async () => {
    auth.resend.mockResolvedValue({ data: {}, error: { code: 'over_email_send_rate_limit' } });
    await expect(resendSignUpCode('a@b.c')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('requestPasswordReset', () => {
  it('requests a reset for the normalized email', async () => {
    auth.resetPasswordForEmail.mockResolvedValue(ok);
    await requestPasswordReset(' Ana@Mail.com ');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@mail.com');
  });
});

describe('resetPassword', () => {
  it('verifies the recovery code, then updates the password', async () => {
    auth.verifyOtp.mockResolvedValue(ok);
    auth.updateUser.mockResolvedValue(ok);
    await resetPassword({ email: 'Ana@Mail.com', code: '123456', password: 'newpass1' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@mail.com',
      token: '123456',
      type: 'recovery',
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newpass1' });
    expect(auth.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
      auth.updateUser.mock.invocationCallOrder[0]!,
    );
  });

  it('does not update the password when the code is wrong', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
    await expect(
      resetPassword({ email: 'a@b.c', code: '1', password: 'newpass1' }),
    ).rejects.toMatchObject({ code: 'INVALID_CODE' });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('signUp', () => {
  const args = { displayName: 'Ana', email: 'Ana@Mail.com', password: 'secret12' };

  it('returns verify when there is no session', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: null },
      error: null,
    });
    await expect(signUp(args)).resolves.toBe('verify');
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@mail.com' }));
  });

  it('returns signed-in when there is a session', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: { access_token: 't' } },
      error: null,
    });
    await expect(signUp(args)).resolves.toBe('signed-in');
  });

  it('throws EMAIL_TAKEN when identities are empty', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    });
    await expect(signUp(args)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });
});

describe('signIn', () => {
  const unconfirmed = { data: {}, error: { code: 'email_not_confirmed' } };

  it('resends the code and throws EMAIL_NOT_CONFIRMED', async () => {
    auth.signInWithPassword.mockResolvedValue(unconfirmed);
    auth.resend.mockResolvedValue(ok);
    await expect(signIn({ email: ' Ana@Mail.com', password: 'x' })).rejects.toMatchObject({
      code: 'EMAIL_NOT_CONFIRMED',
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@mail.com', password: 'x' });
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@mail.com' });
  });

  it('still throws EMAIL_NOT_CONFIRMED when the resend fails', async () => {
    auth.signInWithPassword.mockResolvedValue(unconfirmed);
    auth.resend.mockRejectedValue(new Error('boom'));
    await expect(signIn({ email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
      code: 'EMAIL_NOT_CONFIRMED',
    });
  });
});
