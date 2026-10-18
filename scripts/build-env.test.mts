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

  it('counts an empty value as missing', () => {
    const env = { ...complete, GOOGLE_SERVICES_JSON: '', EAS_BUILD_PROFILE: 'preview' };
    expect(() => assertBuildEnv(env)).toThrow(/GOOGLE_SERVICES_JSON/);
  });
});
