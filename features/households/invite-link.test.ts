import { describe, expect, it } from 'vitest';
import { buildInviteUrl, parseInviteToken } from './invite-link';

const TOKEN = '0123456789abcdef'.repeat(3);

describe('buildInviteUrl', () => {
  it('builds the invite URL with the token query param', () => {
    const createUrl = (path: string, opts: { queryParams: Record<string, string> }) =>
      `casa://${path}?${new URLSearchParams(opts.queryParams).toString()}`;
    expect(buildInviteUrl(TOKEN, createUrl)).toBe(`casa://invite?token=${TOKEN}`);
  });
});

describe('parseInviteToken', () => {
  it('parses a bare token', () => {
    expect(parseInviteToken(TOKEN)).toBe(TOKEN);
    expect(parseInviteToken(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it('parses casa://invite?token=…', () => {
    expect(parseInviteToken(`casa://invite?token=${TOKEN}`)).toBe(TOKEN);
  });

  it('parses exp://192.168.1.10:8081/--/invite?token=…', () => {
    expect(parseInviteToken(`exp://192.168.1.10:8081/--/invite?token=${TOKEN}`)).toBe(TOKEN);
  });

  it('rejects short, uppercase or missing tokens', () => {
    expect(parseInviteToken(TOKEN.slice(1))).toBeNull();
    expect(parseInviteToken(TOKEN.toUpperCase())).toBeNull();
    expect(parseInviteToken(`casa://invite?token=${TOKEN.toUpperCase()}`)).toBeNull();
    expect(parseInviteToken('casa://invite')).toBeNull();
    expect(parseInviteToken('')).toBeNull();
    expect(parseInviteToken(undefined)).toBeNull();
  });

  it('takes the first element of an array param', () => {
    expect(parseInviteToken([TOKEN, 'x'])).toBe(TOKEN);
    expect(parseInviteToken([])).toBeNull();
  });
});
