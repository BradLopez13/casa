import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// What the stores look at in app.json (bloque 15.5). The identifiers are final: once published
// neither store lets them change (LANZAMIENTO.md, decisión 4 de Brad).
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as {
  expo: {
    name: string;
    version: string;
    newArchEnabled?: boolean;
    ios: {
      bundleIdentifier: string;
      usesAppleSignIn?: boolean;
      infoPlist?: Record<string, unknown>;
      config?: { usesNonExemptEncryption?: boolean };
    };
    android: {
      package: string;
      permissions?: string[];
      blockedPermissions?: string[];
      allowBackup?: boolean;
    };
  };
};

describe('app.json for the stores', () => {
  it('keeps the final identifiers and the version', () => {
    expect(app.expo.name).toBe('Nido');
    expect(app.expo.version).toBe('1.0.0');
    expect(app.expo.ios.bundleIdentifier).toBe('com.bradlopez13.casa');
    expect(app.expo.android.package).toBe('com.bradlopez13.casa');
  });

  it('declares no non-exempt encryption, so App Store Connect never asks', () => {
    expect(app.expo.ios.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(app.expo.ios.config?.usesNonExemptEncryption).toBe(false);
  });

  it('asks Android only for what the app uses and blocks what the libraries drag in', () => {
    expect(app.expo.android.permissions).toEqual([
      'INTERNET',
      'VIBRATE',
      'POST_NOTIFICATIONS',
      'RECEIVE_BOOT_COMPLETED',
    ]);
    expect(app.expo.android.blockedPermissions).toEqual([
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ]);
    expect(app.expo.android.allowBackup).toBe(false);
  });

  it('writes the architecture it already compiles with', () => {
    expect(app.expo.newArchEnabled).toBe(true);
  });
});
