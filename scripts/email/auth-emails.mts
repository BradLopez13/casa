// Nido's auth emails (Supabase Auth templates), built from one shared layout so the header and
// footer never drift between files. Run `pnpm emails:build` to write supabase/templates/; the
// test checks the committed files match. Layout rules for mail clients: tables and inline
// styles only, no links, light colour scheme pinned, and an image that already carries its
// background so dark mode cannot recolour it. Supabase Auth keeps one template per email
// type, with no per-person language, so each email carries a Spanish block first, a thin
// rule, then the same block in English.

export const SYMBOL_URL =
  'https://fyojaslimsgcabfbqdba.supabase.co/storage/v1/object/public/email-assets/nido-symbol-v2.png';

const SLATE = '#2E3B41';
const POSIT = '#F2D04B';
const PAPER = '#F3F4F0';
const TEXT = '#1E2A2F';
const WHITE = '#FFFFFF';
const RULE = '#DADDD6';
// M PLUS Rounded 1c only loads in clients that honour web fonts (Apple Mail, iOS).
const FONT = "'M PLUS Rounded 1c', 'Arial Rounded MT Bold', Arial, Helvetica, sans-serif";
const MONO = "'Courier New', Courier, monospace";

export type AuthEmail = { subject: string; html: string };
export type AuthEmailName = 'confirmation' | 'recovery' | 'password_changed';

type Block = {
  title: string;
  preheader: string;
  heading: string;
  body: string;
  footer: string;
};

type Content = { es: Block; en: Block };

const GREETING =
  '{{ if .Data.display_name }}Hola, {{ .Data.display_name }}.{{ else }}Hola.{{ end }}';
const GREETING_EN =
  '{{ if .Data.display_name }}Hi, {{ .Data.display_name }}.{{ else }}Hi.{{ end }}';

const paragraph = (text: string, size = 16) =>
  `<p style="margin: 0 0 16px; font-family: ${FONT}; font-size: ${size}px; line-height: 1.5; color: ${TEXT};">${text}</p>`;

const codePill = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 8px auto 16px;">
              <tr>
                <td align="center" bgcolor="${PAPER}" style="background: ${PAPER}; border: 2px solid ${SLATE}; border-radius: 999px; padding: 12px 28px; font-family: ${MONO}; font-size: 30px; font-weight: bold; letter-spacing: 6px; color: ${TEXT};">{{ .Token }}</td>
              </tr>
            </table>`;

const heading1 = (text: string) =>
  `<h1 style="margin: 0 0 12px; font-family: ${FONT}; font-size: 26px; font-weight: 800; line-height: 1.2; color: ${TEXT};">${text}</h1>`;

const layout = ({ es, en }: Content) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${es.title} / ${en.title}</title>
    <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;800&amp;display=swap" rel="stylesheet">
    <style>
      :root { color-scheme: light; supported-color-schemes: light; }
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: ${PAPER};">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${es.preheader} ${en.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background: ${PAPER};">
      <tr>
        <td align="center" bgcolor="${SLATE}" style="background: ${SLATE}; padding: 28px 16px 64px;">
          <img src="${SYMBOL_URL}" width="48" height="48" alt="" style="display: block; width: 48px; height: 48px; border: 0;">
          <p style="margin: 8px 0 0; font-family: ${FONT}; font-size: 22px; font-weight: 800; color: ${PAPER};">Nido</p>
          <p style="margin: 2px 0 0; font-family: ${FONT}; font-size: 14px; color: ${PAPER};">La casa, en equipo.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0 16px; background: linear-gradient(${SLATE} 0, ${SLATE} 40px, ${PAPER} 40px);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${WHITE}" style="max-width: 480px; background: ${WHITE}; border-radius: 16px;">
            <tr>
              <td align="center" style="padding: 20px 24px 8px;">
                <div style="width: 20px; height: 20px; border-radius: 10px; background: ${POSIT}; font-size: 0; line-height: 0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td align="center" lang="es" style="padding: 8px 24px 8px; text-align: center;">
                ${heading1(es.heading)}
                ${es.body}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 24px;">
                <div style="height: 1px; background: ${RULE}; font-size: 0; line-height: 0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td align="center" lang="en" style="padding: 24px 24px 24px; text-align: center;">
                ${heading1(en.heading)}
                ${en.body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 20px 24px 32px;">
          <div lang="es">${paragraph(es.footer, 13)}</div>
          <div lang="en">${paragraph(en.footer, 13)}</div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const SEP = '\n                ';

const emails: Record<AuthEmailName, { subject: string; content: Content }> = {
  confirmation: {
    subject: 'Tu código de Nido / Your Nido code',
    content: {
      es: {
        title: 'Confirma tu correo',
        preheader: 'Tu código para confirmar el correo en Nido.',
        heading: 'Confirma tu correo',
        body: [
          paragraph(`${GREETING} Escribe este código en Nido:`),
          codePill(),
          paragraph('Caduca en 15 minutos.', 14),
        ].join(SEP),
        footer: 'Si no lo has pedido tú, ignora este correo.',
      },
      en: {
        title: 'Confirm your email',
        preheader: 'Your code to confirm your email in Nido.',
        heading: 'Confirm your email',
        body: [
          paragraph(`${GREETING_EN} Enter this code in Nido:`),
          codePill(),
          paragraph('It expires in 15 minutes.', 14),
        ].join(SEP),
        footer: 'If you did not ask for this, ignore this email.',
      },
    },
  },
  recovery: {
    subject: 'Recupera tu contraseña de Nido / Reset your Nido password',
    content: {
      es: {
        title: 'Recupera tu contraseña',
        preheader: 'Tu código para elegir una contraseña nueva en Nido.',
        heading: 'Recupera tu contraseña',
        body: [
          paragraph(`${GREETING} Escribe este código en Nido para elegir una contraseña nueva:`),
          codePill(),
          paragraph('Caduca en 15 minutos.', 14),
        ].join(SEP),
        footer: 'Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.',
      },
      en: {
        title: 'Reset your password',
        preheader: 'Your code to choose a new password in Nido.',
        heading: 'Reset your password',
        body: [
          paragraph(`${GREETING_EN} Enter this code in Nido to choose a new password:`),
          codePill(),
          paragraph('It expires in 15 minutes.', 14),
        ].join(SEP),
        footer: 'If you did not ask for this, ignore this email: your password stays the same.',
      },
    },
  },
  password_changed: {
    subject: 'Tu contraseña de Nido ha cambiado / Your Nido password has changed',
    content: {
      es: {
        title: 'Tu contraseña ha cambiado',
        preheader: 'Aviso de seguridad de tu cuenta de Nido.',
        heading: 'Tu contraseña ha cambiado',
        body: [
          paragraph('Hola. La contraseña de tu cuenta de Nido ({{ .Email }}) acaba de cambiar.'),
          paragraph('Si has sido tú, no tienes que hacer nada.'),
          paragraph(
            'Si no has sido tú, abre Nido, pulsa «¿Has olvidado tu contraseña?» y elige una nueva.',
          ),
        ].join(SEP),
        footer: 'Este aviso se envía siempre que cambia la contraseña de tu cuenta.',
      },
      en: {
        title: 'Your password has changed',
        preheader: 'A security notice about your Nido account.',
        heading: 'Your password has changed',
        body: [
          paragraph('Hi. The password of your Nido account ({{ .Email }}) has just changed.'),
          paragraph('If it was you, there is nothing to do.'),
          paragraph(
            'If it was not you, open Nido, tap “Forgot your password?” and choose a new one.',
          ),
        ].join(SEP),
        footer: 'This notice is sent whenever the password of your account changes.',
      },
    },
  },
};

/** The rendered subject and HTML of each auth email. */
export function authEmails(): Record<AuthEmailName, AuthEmail> {
  const out = {} as Record<AuthEmailName, AuthEmail>;
  for (const [name, { subject, content }] of Object.entries(emails) as [
    AuthEmailName,
    (typeof emails)[AuthEmailName],
  ][]) {
    out[name] = { subject, html: layout(content) };
  }
  return out;
}
