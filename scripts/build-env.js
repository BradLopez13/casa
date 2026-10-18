// What an EAS build for testers or the stores cannot go without. app.config.js checks it, so a
// build missing any of these stops while reading the config instead of shipping an app that
// cannot reach Supabase, cannot report errors or reports them unreadable.
const PUBLIC_BUILD_ENV = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
];
// Secret EAS variables reach only the builder (EAS_BUILD=true), not the first read of the config
// that eas build does on the computer, so they are checked there.
const SECRET_BUILD_ENV = [
  // FCM config, an EAS file variable.
  'GOOGLE_SERVICES_JSON',
  // Uploads the source maps; without it Sentry shows minified frames.
  'SENTRY_AUTH_TOKEN',
];
const REQUIRED_BUILD_ENV = [...PUBLIC_BUILD_ENV, ...SECRET_BUILD_ENV];

const CHECKED_PROFILES = ['preview', 'production'];

/** @param {Record<string, string | undefined>} env */
function assertBuildEnv(env) {
  const profile = env.EAS_BUILD_PROFILE;
  if (!profile || !CHECKED_PROFILES.includes(profile)) return;
  const required = env.EAS_BUILD === 'true' ? REQUIRED_BUILD_ENV : PUBLIC_BUILD_ENV;
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `The "${profile}" build is missing: ${missing.join(', ')}. Add them with eas env:create (see the README).`,
    );
  }
}

module.exports = { assertBuildEnv, REQUIRED_BUILD_ENV };
