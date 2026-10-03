import type { ExpoConfig } from 'expo/config';
import appJson from './app.json';

// The E2E build is a release build that talks plain http to the local Supabase stack
// (10.0.2.2 from the emulator), so Android must allow cleartext traffic. Normal builds
// are unchanged.
const config: ExpoConfig = appJson.expo as ExpoConfig;

export default (): ExpoConfig => ({
  ...config,
  plugins:
    process.env.E2E === '1'
      ? [
          ...(config.plugins ?? []),
          ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
        ]
      : config.plugins,
});
