// Dynamic layer over app.json (Expo passes it in as `config`).
const { existsSync } = require('node:fs');
const { assertBuildEnv } = require('./scripts/build-env');

// google-services.json (FCM) is never committed: EAS provides it as a file secret through
// GOOGLE_SERVICES_JSON; locally it is used when present; CI builds without it.
function googleServicesFile() {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON;
  return existsSync('./google-services.json') ? './google-services.json' : undefined;
}

/**
 * With a domain for the invitations (EXPO_PUBLIC_INVITE_HOST, decisión 1: A at the launch), its
 * https links open Nido: Android App Links, verified against the domain's assetlinks.json, and iOS
 * Universal Links. Without it, nothing changes: the invitation is casa://invite (site/INVITACIONES.md).
 * @param {string | undefined} host
 */
function inviteLinks(host) {
  // A host with a path (a GitHub Pages project site) cannot be verified: App Links and Universal
  // Links are checked at the root of the domain.
  if (!host || host.includes('/')) return { android: {}, ios: {} };
  return {
    android: {
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host, pathPrefix: '/invite' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    ios: { associatedDomains: [`applinks:${host}`] },
  };
}

/**
 * The Google Sign-In config plugin, only with the iOS URL scheme it demands (bloque 15.4): it
 * throws without one, and Android needs no plugin, so until EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
 * exists the plugin stays out and the iOS prebuild passes.
 * @param {Record<string, string | undefined>} env
 * @returns {[string, { iosUrlScheme: string }] | null}
 */
function googlePlugin(env) {
  const scheme = env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (!scheme) return null;
  return ['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }];
}

/**
 * GoogleService-Info.plist (Firebase on iOS): an EAS file variable, as the Android json.
 * @param {Record<string, string | undefined>} env
 */
function googleServicesPlist(env) {
  return env.GOOGLE_SERVICES_PLIST || undefined;
}

/** @param {{ config: import('expo/config').ExpoConfig }} ctx */
module.exports = ({ config }) => {
  assertBuildEnv(process.env);
  const file = googleServicesFile();
  const plist = googleServicesPlist(process.env);
  const google = googlePlugin(process.env);
  const links = inviteLinks(process.env.EXPO_PUBLIC_INVITE_HOST);
  const plugins = [...(config.plugins ?? []), ...(google ? [google] : [])];
  return {
    ...config,
    android: {
      ...config.android,
      ...(file ? { googleServicesFile: file } : {}),
      ...links.android,
    },
    ios: { ...config.ios, ...(plist ? { googleServicesFile: plist } : {}), ...links.ios },
    // The E2E build is a release build that talks plain http to the local Supabase stack
    // (10.0.2.2 from the emulator), so Android must allow cleartext traffic. Normal builds
    // are unchanged.
    plugins:
      process.env.E2E === '1'
        ? [...plugins, ['expo-build-properties', { android: { usesCleartextTraffic: true } }]]
        : plugins,
  };
};

module.exports.inviteLinks = inviteLinks;
module.exports.googlePlugin = googlePlugin;
module.exports.googleServicesPlist = googleServicesPlist;
