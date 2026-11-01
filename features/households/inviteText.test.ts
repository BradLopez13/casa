import { describe, expect, it } from 'vitest';
import { inviteExpiresText, invitePreviewText } from './inviteText';

describe('inviteExpiresText', () => {
  it('writes day and month of a date', () =>
    expect(inviteExpiresText('2026-10-23')).toBe('Caduca el 23 de octubre'));
  it('writes day and month of a timestamp', () =>
    expect(inviteExpiresText('2026-10-23T12:00:00Z')).toBe('Caduca el 23 de octubre'));
});

describe('invitePreviewText', () => {
  it('falls back to the plain title without a preview', () =>
    expect(invitePreviewText(null)).toEqual({ title: 'Te han invitado a una casa', from: null }));
  it('names the household and who invites', () =>
    expect(
      invitePreviewText({ householdName: 'Casa', inviterName: 'Ana', memberCount: 1 }),
    ).toEqual({ title: 'Te invitan a «Casa»', from: 'Ana te invita · 1 miembro' }));
  it('counts the members in plural', () =>
    expect(
      invitePreviewText({ householdName: 'Casa', inviterName: 'Ana', memberCount: 3 }).from,
    ).toBe('Ana te invita · 3 miembros'));
  it('shows only the members when the inviter is gone', () =>
    expect(
      invitePreviewText({ householdName: 'Casa', inviterName: null, memberCount: 3 }).from,
    ).toBe('3 miembros'));
});
