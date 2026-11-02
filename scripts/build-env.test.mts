import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// build-env.js is CommonJS because app.config.js requires it.
const { assertBuildEnv } = createRequire(import.meta.url)('./build-env.js') as {
  assertBuildEnv: (env: Record<string, string | undefined>) => void;
};

const complete = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_KEY: 'k',
  EXPO_PUBLIC_SENTRY_DSN: 'https://d@o1.ingest.de.sentry.io/1',
  GOOGLE_SERVICES_JSON: '/tmp/google-services.json',
  SENTRY_AUTH_TOKEN: 'sntrys_x',
  // Set on the EAS builder only.
  EAS_BUILD: 'true',
};

describe('assertBuildEnv', () => {
  it('asks for nothing outside an EAS build', () => {
    expect(() => assertBuildEnv({})).not.toThrow();
  });

  it('asks for nothing in a development build', () => {
    expect(() => assertBuildEnv({ EAS_BUILD_PROFILE: 'development' })).not.toThrow();
  });

  it('lets preview and production through when everything is set', () => {
    expect(() => assertBuildEnv({ ...complete, EAS_BUILD_PROFILE: 'preview' })).not.toThrow();
    expect(() => assertBuildEnv({ ...complete, EAS_BUILD_PROFILE: 'production' })).not.toThrow();
  });

  it('stops a production build and names the profile and every missing variable', () => {
    const env = {
      ...complete,
      EXPO_PUBLIC_SENTRY_DSN: undefined,
      SENTRY_AUTH_TOKEN: undefined,
      EAS_BUILD_PROFILE: 'production',
    };
    expect(() => assertBuildEnv(env)).toThrow(/production/);
    expect(() => assertBuildEnv(env)).toThrow(/EXPO_PUBLIC_SENTRY_DSN/);
    expect(() => assertBuildEnv(env)).toThrow(/SENTRY_AUTH_TOKEN/);
  });

  it('checks only the public variables when eas build reads the config on the computer', () => {
    // Secret EAS variables are not sent to that first, local read of app.config.js.
    const local = {
      ...complete,
      EAS_BUILD: undefined,
      SENTRY_AUTH_TOKEN: undefined,
      GOOGLE_SERVICES_JSON: undefined,
      EAS_BUILD_PROFILE: 'preview',
    };
    expect(() => assertBuildEnv(local)).not.toThrow();
    expect(() => assertBuildEnv({ ...local, EXPO_PUBLIC_SENTRY_DSN: '' })).toThrow(
      /EXPO_PUBLIC_SENTRY_DSN/,
    );
  });

  it('counts an empty value as missing', () => {
    const env = { ...complete, GOOGLE_SERVICES_JSON: '', EAS_BUILD_PROFILE: 'preview' };
    expect(() => assertBuildEnv(env)).toThrow(/GOOGLE_SERVICES_JSON/);
  });
});

// Bloque 15.7: the queue log is for the test phones only, and every new variable is optional.
describe('assertBuildEnv in production', () => {
  it('refuses EXPO_PUBLIC_QUEUE_LOG, which writes the queue to the console', () => {
    const env = { ...complete, EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_QUEUE_LOG: '1' };
    expect(() => assertBuildEnv(env)).toThrow(/EXPO_PUBLIC_QUEUE_LOG/);
    expect(() => assertBuildEnv({ ...env, EAS_BUILD_PROFILE: 'preview' })).not.toThrow();
  });

  it('asks for none of the store, sign-in or billing variables: empty, the app is as today', () => {
    const env = {
      ...complete,
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_AUTH_GOOGLE: '',
      EXPO_PUBLIC_AUTH_APPLE: '',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
      EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: '',
      EXPO_PUBLIC_REVENUECAT_IOS_KEY: '',
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: '',
      EXPO_PUBLIC_BILLING_ENABLED: '',
      EXPO_PUBLIC_INVITE_HOST: '',
      EXPO_PUBLIC_SITE_URL: '',
      GOOGLE_SERVICES_PLIST: '',
    };
    expect(() => assertBuildEnv(env)).not.toThrow();
  });
});
