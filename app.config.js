// Dynamic layer over app.json (Expo passes it in as `config`).
const { existsSync } = require('node:fs');
const { assertBuildEnv } = require('./scripts/build-env');

// google-services.json (FCM) is never committed: EAS provides it as a file secret through
// GOOGLE_SERVICES_JSON; locally it is used when present; CI builds without it.
function googleServicesFile() {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON;
  return existsSync('./google-services.json') ? './google-services.json' : undefined;
}

/** @param {{ config: import('expo/config').ExpoConfig }} ctx */
module.exports = ({ config }) => {
  assertBuildEnv(process.env);
  const file = googleServicesFile();
  return {
    ...config,
    android: { ...config.android, ...(file ? { googleServicesFile: file } : {}) },
    // The E2E build is a release build that talks plain http to the local Supabase stack
    // (10.0.2.2 from the emulator), so Android must allow cleartext traffic. Normal builds
    // are unchanged.
    plugins:
      process.env.E2E === '1'
        ? [
            ...(config.plugins ?? []),
            ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
          ]
        : config.plugins,
  };
};
