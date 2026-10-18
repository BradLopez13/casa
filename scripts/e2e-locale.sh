#!/usr/bin/env bash
# CI baseline: every shard first runs `bash scripts/e2e-locale.sh es true` (the emulator boots en-US,
# the flows assert Spanish), so es-ES is the language the flows expect.
# Runs a command with the emulator in another language, then puts it back to Spanish:
#   bash scripts/e2e-locale.sh en maestro test e2e/locale/english.yaml
# The app reads the phone language once when its JavaScript starts (Task 35), and Maestro cannot
# change it, so the language is set here, before the flow launches the app. It needs a rootable
# image (the CI emulator uses google_apis; a Play Store image refuses `adb root`). Use it only on
# the emulator of a CI shard or a throwaway one: the zygote restart closes every running app.
set -euo pipefail

lang="${1:-}"
case "$lang" in
  en) tag=en-US ;;
  es) tag=es-ES ;;
  *) echo "usage: e2e-locale.sh <es|en> <command...>" >&2; exit 1 ;;
esac
[ "$#" -ge 2 ] || { echo "usage: e2e-locale.sh <es|en> <command...>" >&2; exit 1; }
shift

set_locale() {
  adb root > /dev/null
  adb wait-for-device
  adb shell "setprop persist.sys.locale $1; setprop ctl.restart zygote"
  # The restart drops the boot flag: wait for it to come back before anything else runs.
  sleep 5
  adb wait-for-device
  for _ in $(seq 1 60); do
    [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ] && return 0
    sleep 2
  done
  echo "e2e-locale: the emulator did not come back after changing the language" >&2
  return 1
}

# Switching back is only needed after another language; `es` is the baseline and restores nothing.
if [ "$lang" != "es" ]; then
  trap 'set_locale es-ES' EXIT
fi
set_locale "$tag"
"$@"
