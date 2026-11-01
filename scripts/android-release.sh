#!/usr/bin/env bash
# The one way to build a local release APK for the test phones (bloque 13, T-1 and Aud P3-12):
# regenerates android/ from app.json (a stale folder kept allowBackup="true"), drops the JS bundle
# Gradle would reuse from a build made for another environment, builds for arm64 and checks that
# the bundle talks to the expected Supabase before anything is installed.
#
#   pnpm android:release                      # .env + .env.local, EXPO_PUBLIC_APP_ENV=preview
#   EXPECTED_SUPABASE_URL=https://… pnpm android:release
#   ARCH=x86_64 pnpm android:release          # an emulator
#
# On Windows, build from a checkout with a short path (MAX_PATH), e.g. C:/Users/<you>/b10.
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
[ -f .env ] && . ./.env
[ -f .env.local ] && . ./.env.local
set +a
export EXPO_PUBLIC_APP_ENV="${EXPO_PUBLIC_APP_ENV:-preview}"

if [ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" ]; then
  echo "EXPO_PUBLIC_SUPABASE_URL is not set (.env)." >&2
  exit 1
fi
expected="${EXPECTED_SUPABASE_URL:-$EXPO_PUBLIC_SUPABASE_URL}"
arch="${ARCH:-arm64-v8a}"

echo "Building a release for ${expected} (${EXPO_PUBLIC_APP_ENV}, ${arch})."
# A Gradle daemon from the last build keeps files open, and Windows will not delete them.
if [ -x android/gradlew ]; then (cd android && ./gradlew --stop >/dev/null 2>&1) || true; fi
CI=1 pnpm exec expo prebuild --platform android --clean --no-install
# Gradle takes the bundle task as up to date when no source changed, even if EXPO_PUBLIC_* did.
rm -rf android/app/build/generated/assets/react/release
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures="${arch}")

apk=android/app/build/outputs/apk/release/app-release.apk
node scripts/bundle-url.mjs "$apk" "$expected"
if grep -q 'android:allowBackup="true"' android/app/src/main/AndroidManifest.xml; then
  echo 'The manifest allows backups: app.json says it must not.' >&2
  exit 1
fi
echo "Ready: $apk"
