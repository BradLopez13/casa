// Checks which Supabase a release APK's JS bundle talks to (bloque 13, T-1): Gradle once kept the
// bundle of an earlier build, made for another environment, because no source had changed.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// A Hermes bundle keeps its strings back to back, so a URL is matched by its shape, not by what
// follows it: a project ref is 20 lowercase letters; a local stack listens on 54321.
const HOSTED = /https:\/\/[a-z]{20}\.supabase\.co/g;
const LOCAL = /(?:https?:\/\/)?(?:(?:\d{1,3}\.){3}\d{1,3}|localhost):54321/g;

/** Every Supabase the bundle names, hosted or local, once each. */
export function bundleUrls(text) {
  const found = [...(text.match(HOSTED) ?? []), ...(text.match(LOCAL) ?? [])].map((url) =>
    url.startsWith('http') ? url : `http://${url}`,
  );
  return [...new Set(found)];
}

/** Whether the bundle names the expected Supabase and no other, and what it names. */
export function checkBundle(text, expected) {
  const urls = bundleUrls(text);
  const want = expected.replace(/\/+$/, '');
  return { ok: urls.length === 1 && urls[0] === want, urls };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [apk, expected] = process.argv.slice(2);
  if (!apk || !expected) {
    console.error('Usage: node scripts/bundle-url.mjs <app-release.apk> <expected Supabase URL>');
    process.exit(2);
  }
  const text = execFileSync('unzip', ['-p', apk, 'assets/index.android.bundle'], {
    encoding: 'latin1',
    maxBuffer: 256 * 1024 * 1024,
  });
  const { ok, urls } = checkBundle(text, expected);
  if (!ok) {
    console.error(`The bundle names ${urls.join(', ') || 'no Supabase'}; expected ${expected}.`);
    process.exit(1);
  }
  process.stdout.write(`Bundle OK: it talks to ${expected} and nothing else.\n`);
}
