#!/usr/bin/env bash
# Writes .env.e2e for the E2E build from the running local Supabase stack.
# 10.0.2.2 is the host machine as seen from the Android emulator.
set -euo pipefail

status="$(pnpm --silent supabase status -o env)"

value() {
  printf '%s\n' "$status" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" | head -n 1
}

key="$(value PUBLISHABLE_KEY)"
if [ -z "$key" ]; then key="$(value ANON_KEY)"; fi
if [ -z "$key" ]; then
  echo "e2e-env: no PUBLISHABLE_KEY or ANON_KEY in 'supabase status -o env'. Is Supabase running?" >&2
  exit 1
fi

cat > .env.e2e <<ENV
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
EXPO_PUBLIC_SUPABASE_KEY=$key
ENV
echo "Wrote .env.e2e"
