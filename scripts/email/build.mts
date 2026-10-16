// Writes the auth email templates to supabase/templates/. Run with `pnpm emails:build`.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { authEmails } from './auth-emails.mts';

const dir = join(import.meta.dirname, '..', '..', 'supabase/templates');

for (const [name, { subject, html }] of Object.entries(authEmails())) {
  writeFileSync(join(dir, `${name}.html`), html);
  process.stdout.write(`${name}.html  «${subject}»  ${html.length} bytes\n`);
}
