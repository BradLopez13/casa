import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { authEmails, SYMBOL_URL } from './auth-emails.mts';

const root = join(import.meta.dirname, '..', '..');
const names = ['confirmation', 'recovery', 'password_changed'] as const;
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('auth emails', () => {
  it('renders the three emails the app sends', () => {
    expect(Object.keys(authEmails()).sort()).toEqual([...names].sort());
  });

  it.each(names)('%s carries the Nido layout', (name) => {
    const html = authEmails()[name].html;
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain(SYMBOL_URL);
    expect(html).toContain('La casa, en equipo.');
  });

  it.each(names)('%s uses the Pizarra y pósit palette', (name) => {
    const html = authEmails()[name].html.toUpperCase();
    for (const old of ['#263663', '#F0AD83', '#FFF6E8']) expect(html).not.toContain(old);
    expect(html).toContain('#2E3B41');
    expect(html).toContain('#F2D04B');
  });

  it.each(names)('%s has no links to click', (name) => {
    expect(authEmails()[name].html).not.toMatch(/<a[\s>]/i);
  });

  it.each(['confirmation', 'recovery'] as const)('%s shows the code once', (name) => {
    expect(count(authEmails()[name].html, '{{ .Token }}')).toBe(1);
  });

  it.each(['confirmation', 'recovery'] as const)('%s code pill has a slate border', (name) => {
    expect(authEmails()[name].html).toMatch(/border: 2px solid #2E3B41[^"]*">{{ .Token }}/);
  });

  it('the password notice has no code', () => {
    expect(authEmails().password_changed.html).not.toContain('{{ .Token }}');
  });

  it.each(['confirmation', 'recovery'] as const)('%s greets by name when there is one', (name) => {
    const html = authEmails()[name].html;
    expect(html).toContain('{{ if .Data.display_name }}Hola, {{ .Data.display_name }}.');
    expect(html).toContain('{{ else }}Hola.{{ end }}');
  });

  it('the password notice names the app link and asks for a new password', () => {
    const html = authEmails().password_changed.html;
    expect(html).toContain('pulsa «¿Has olvidado tu contraseña?» y elige una nueva.');
    expect(html).not.toContain('Olvidaste');
  });

  it('subjects follow the brand voice', () => {
    const emails = authEmails();
    expect(emails.confirmation.subject).toBe('Tu código de Nido');
    expect(emails.recovery.subject).toBe('Recupera tu contraseña de Nido');
    expect(emails.password_changed.subject).toBe('Tu contraseña de Nido ha cambiado');
  });

  it.each(names)('supabase/config.toml uses the %s subject and file', (name) => {
    const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
    const block = new RegExp(
      `\\[auth\\.email\\.(?:template|notification)\\.${name}\\]\\n(?:enabled = true\\n)?` +
        `subject = "([^"]+)"\\ncontent_path = "\\./supabase/templates/${name}\\.html"`,
    );
    expect(config.match(block)?.[1]).toBe(authEmails()[name].subject);
  });

  it.each(names)('supabase/templates/%s.html is up to date (pnpm emails:build)', (name) => {
    const committed = readFileSync(join(root, 'supabase/templates', `${name}.html`), 'utf8');
    expect(committed).toBe(authEmails()[name].html);
  });
});
