// Nido's auth emails (Supabase Auth templates), built from one shared layout so the header and
// footer never drift between files. Run `pnpm emails:build` to write supabase/templates/; the
// test checks the committed files match. Layout rules for mail clients: tables and inline
// styles only, no links, light colour scheme pinned, and an image that already carries its
// background so dark mode cannot recolour it.

export const SYMBOL_URL =
  'https://fyojaslimsgcabfbqdba.supabase.co/storage/v1/object/public/email-assets/nido-symbol-v2.png';

const SLATE = '#2E3B41';
const POSIT = '#F2D04B';
const PAPER = '#F3F4F0';
const TEXT = '#1E2A2F';
const WHITE = '#FFFFFF';
// M PLUS Rounded 1c only loads in clients that honour web fonts (Apple Mail, iOS).
const FONT = "'M PLUS Rounded 1c', 'Arial Rounded MT Bold', Arial, Helvetica, sans-serif";
const MONO = "'Courier New', Courier, monospace";

export type AuthEmail = { subject: string; html: string };
export type AuthEmailName = 'confirmation' | 'recovery' | 'password_changed';

type Content = {
  title: string;
  preheader: string;
  heading: string;
  body: string;
  footer: string;
};

const GREETING =
  '{{ if .Data.display_name }}Hola, {{ .Data.display_name }}.{{ else }}Hola.{{ end }}';

const paragraph = (text: string, size = 16) =>
  `<p style="margin: 0 0 16px; font-family: ${FONT}; font-size: ${size}px; line-height: 1.5; color: ${TEXT};">${text}</p>`;

const codePill = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 8px auto 16px;">
              <tr>
                <td align="center" bgcolor="${PAPER}" style="background: ${PAPER}; border: 2px solid ${SLATE}; border-radius: 999px; padding: 12px 28px; font-family: ${MONO}; font-size: 30px; font-weight: bold; letter-spacing: 6px; color: ${TEXT};">{{ .Token }}</td>
              </tr>
            </table>`;

const layout = ({ title, preheader, heading, body, footer }: Content) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;800&amp;display=swap" rel="stylesheet">
    <style>
      :root { color-scheme: light; supported-color-schemes: light; }
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: ${PAPER};">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>
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
              <td align="center" style="padding: 8px 24px 24px; text-align: center;">
                <h1 style="margin: 0 0 12px; font-family: ${FONT}; font-size: 26px; font-weight: 800; line-height: 1.2; color: ${TEXT};">${heading}</h1>
                ${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 20px 24px 32px;">
          ${paragraph(footer, 13)}
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const emails: Record<AuthEmailName, { subject: string; content: Content }> = {
  confirmation: {
    subject: 'Tu código de Nido',
    content: {
      title: 'Confirma tu correo',
      preheader: 'Tu código para confirmar el correo en Nido.',
      heading: 'Confirma tu correo',
      body: [
        paragraph(`${GREETING} Escribe este código en Nido:`),
        codePill(),
        paragraph('Caduca en 15 minutos.', 14),
      ].join('\n                '),
      footer: 'Si no lo has pedido tú, ignora este correo.',
    },
  },
  recovery: {
    subject: 'Recupera tu contraseña de Nido',
    content: {
      title: 'Recupera tu contraseña',
      preheader: 'Tu código para elegir una contraseña nueva en Nido.',
      heading: 'Recupera tu contraseña',
      body: [
        paragraph(`${GREETING} Escribe este código en Nido para elegir una contraseña nueva:`),
        codePill(),
        paragraph('Caduca en 15 minutos.', 14),
      ].join('\n                '),
      footer: 'Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.',
    },
  },
  password_changed: {
    subject: 'Tu contraseña de Nido ha cambiado',
    content: {
      title: 'Tu contraseña ha cambiado',
      preheader: 'Aviso de seguridad de tu cuenta de Nido.',
      heading: 'Tu contraseña ha cambiado',
      body: [
        paragraph('Hola. La contraseña de tu cuenta de Nido ({{ .Email }}) acaba de cambiar.'),
        paragraph('Si has sido tú, no tienes que hacer nada.'),
        paragraph(
          'Si no has sido tú, abre Nido, pulsa «¿Olvidaste la contraseña?» y elige otra cuanto antes.',
        ),
      ].join('\n                '),
      footer: 'Este aviso se envía siempre que cambia la contraseña de tu cuenta.',
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
