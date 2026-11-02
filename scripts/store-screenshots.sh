#!/usr/bin/env bash
# The store listing's screenshots (store/capturas.md), repeatable:
#
#   pnpm store:screenshots                 # phone profile, light and dark
#   PROFILE=tablet pnpm store:screenshots  # 10" tablet, landscape
#
# Needs: the local Supabase stack with the E2E fixtures (`pnpm db:reset && pnpm e2e:fixtures`),
# `.env.e2e` (`pnpm e2e:env`), the E2E build installed on a running emulator or phone
# (`E2E=1 ARCH=x86_64 pnpm android:release`, then `adb install`), and Maestro on the PATH. The
# flow signs in as demo@e2e.dev («Casa de ejemplo») and saves PNGs in store/screenshots/<profile>/,
# once with the system in light and once in dark (`cmd uimode night`), leaving it as it was.
set -euo pipefail

cd "$(dirname "$0")/.."

profile="${PROFILE:-phone}"
out="store/screenshots/${profile}"
mkdir -p "$out"

if ! command -v maestro > /dev/null 2>&1; then
  echo "store-screenshots: maestro is not on the PATH (https://maestro.mobile.dev)." >&2
  exit 1
fi
if [ ! -f .env.e2e ]; then
  echo "store-screenshots: no .env.e2e. Run 'pnpm e2e:env' first." >&2
  exit 1
fi

# The emulator's night mode as it was, to put it back.
was="$(adb shell cmd uimode night 2> /dev/null | tr -d '\r' | sed -n 's/^Night mode: //p')"
restore() {
  if [ -n "$was" ]; then adb shell cmd uimode night "$was" > /dev/null 2>&1 || true; fi
}
trap restore EXIT

for theme in claro oscuro; do
  if [ "$theme" = oscuro ]; then adb shell cmd uimode night yes > /dev/null; else adb shell cmd uimode night no > /dev/null; fi
  sleep 2
  maestro test -e OUT="$out" -e THEME="$theme" e2e/store/screenshots.yaml
done

echo "Screenshots in $out:"
ls -1 "$out"
