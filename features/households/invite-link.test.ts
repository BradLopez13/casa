import { describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { buildInviteUrl, inviteMessage, parseInviteToken } from './invite-link';

const TOKEN = '0123456789abcdef'.repeat(3);

describe('buildInviteUrl', () => {
  it('builds the invite URL with the token query param', () => {
    const createUrl = (path: string, opts: { queryParams: Record<string, string> }) =>
      `casa://${path}?${new URLSearchParams(opts.queryParams).toString()}`;
    expect(buildInviteUrl(TOKEN, createUrl, null)).toBe(`casa://invite?token=${TOKEN}`);
  });

  // Decisión 1 (Brad, 2 de noviembre): a link a chat app lets you tap, on GitHub Pages until the
  // domain exists.
  it('builds an https link on the invite host, the GitHub Pages site by default', () => {
    const createUrl = () => 'casa://unused';
    expect(buildInviteUrl(TOKEN, createUrl)).toBe(
      `https://bradlopez13.github.io/casa/invite/?token=${TOKEN}`,
    );
    expect(buildInviteUrl(TOKEN, createUrl, 'nido.example')).toBe(
      `https://nido.example/invite/?token=${TOKEN}`,
    );
  });
});

describe('inviteMessage (bloque 14.3)', () => {
  // P1-3: the message was «Te invito a mi casa en Nido: casa://…»; in WhatsApp nothing said how to
  // join, and the link ran into the sentence.
  it('says how to join in two steps and ends with the link alone on its line', () => {
    const url = `casa://invite?token=${TOKEN}`;
    const message = inviteMessage(url, 'Casa de prueba');
    const lines = message.split('\n');
    expect(lines.at(-1)).toBe(url);
    expect(lines.at(-2)).toBe('');
    expect(message).toContain('«Casa de prueba»');
    expect(message).toContain(t('households.join'));
    expect(parseInviteToken(message)).toBe(TOKEN);
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
    // The keyboard may capitalise a pasted token (bloque 15.5, P3-6d): it still counts.
    expect(parseInviteToken(TOKEN.toUpperCase())).toBe(TOKEN);
    expect(parseInviteToken(`casa://invite?token=${TOKEN.toUpperCase()}`)).toBe(TOKEN);
    expect(parseInviteToken('casa://invite')).toBeNull();
    expect(parseInviteToken('')).toBeNull();
    expect(parseInviteToken(undefined)).toBeNull();
  });

  // «Unirme con un enlace» takes the whole message pasted, and an https link (bloque 14.3).
  it('parses the whole message pasted, line breaks and all', () => {
    const message = `Te invito a mi casa.
Si no tienes Nido…

casa://invite?token=${TOKEN}`;
    expect(parseInviteToken(message)).toBe(TOKEN);
  });

  it('parses an https invite link', () => {
    expect(parseInviteToken(`https://nido.example/invite?token=${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteToken(`https://bradlopez13.github.io/casa/invite/?token=${TOKEN}`)).toBe(
      TOKEN,
    );
  });

  it('takes the first element of an array param', () => {
    expect(parseInviteToken([TOKEN, 'x'])).toBe(TOKEN);
    expect(parseInviteToken([])).toBeNull();
  });
});
