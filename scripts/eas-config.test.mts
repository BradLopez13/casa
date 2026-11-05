import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// What the stores' build and submit profiles promise (bloque 15.7): nothing signs or sends
// without the variables, and with them nothing has to be programmed.
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')) as {
  cli: { appVersionSource: string };
  build: Record<
    string,
    {
      autoIncrement?: boolean;
      credentialsSource?: string;
      env?: Record<string, string>;
      android?: { buildType?: string };
    }
  >;
  submit: {
    production: {
      android: { serviceAccountKeyPath: string; track: string };
      ios: { ascAppId: string; appleTeamId: string; appleId: string };
    };
  };
};

describe('eas.json', () => {
  it('keeps the build number in EAS and the credentials there too', () => {
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.production?.autoIncrement).toBe(true);
    expect(eas.build.production?.credentialsSource).toBe('remote');
  });

  it('builds an app bundle for Play in production and an APK for the test phones in preview', () => {
    expect(eas.build.production?.android?.buildType).toBe('app-bundle');
    expect(eas.build.preview?.android?.buildType).toBe('apk');
    expect(eas.build.production?.env?.EXPO_PUBLIC_APP_ENV).toBe('production');
  });

  it('submits with the variables LANZAMIENTO.md names, to the internal track and TestFlight', () => {
    const { android, ios } = eas.submit.production;
    expect(android.serviceAccountKeyPath).toBe('$GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    expect(android.track).toBe('internal');
    expect(ios).toEqual({
      ascAppId: '$ASC_APP_ID',
      appleTeamId: '$APPLE_TEAM_ID',
      appleId: '$APPLE_ID',
    });
  });
});

describe('release.yml', () => {
  const yml = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

  it('runs on a v* tag or by hand, and ends green without EXPO_TOKEN', () => {
    expect(yml).toContain("tags: ['v*']");
    expect(yml).toContain('workflow_dispatch');
    expect(yml).toContain('secrets.EXPO_TOKEN');
    expect(yml).toContain("steps.token.outputs.present == 'true'");
    expect(yml).not.toMatch(/exit 1/);
  });

  // Revisión del PR #67: `eas build --no-wait` and then `eas submit --latest` sent the build before
  // this one (or failed with none). The build submits itself once it is done.
  it('builds the production profile and submits that same build when it is done', () => {
    expect(yml).toContain('eas build --platform');
    expect(yml).toContain('--profile production');
    expect(yml).toContain('--auto-submit');
    expect(yml).not.toContain('--latest');
    expect(yml).not.toMatch(/eas build[^\n]*--auto-submit[^\n]*--no-wait/);
    expect(yml).toMatch(/timeout-minutes: (9\d|1\d\d)/);
  });
});

describe('ci.yml', () => {
  const yml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  it('generates the iOS project on every run, so no plugin can break it unseen', () => {
    expect(yml).toContain('expo prebuild --platform ios --no-install');
  });
});
