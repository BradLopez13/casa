#!/usr/bin/env bash
# Runs the Maestro flows with the key from .env.e2e (written by `pnpm e2e:env`): the realtime
# flow's script calls the local Supabase API with it. Extra arguments go to `maestro test`.
set -euo pipefail

if [ ! -f .env.e2e ]; then
  echo "e2e-run: no .env.e2e. Run 'pnpm e2e:env' first." >&2
  exit 1
fi

set -a
. ./.env.e2e
set +a

exec maestro test -e SUPABASE_KEY="$EXPO_PUBLIC_SUPABASE_KEY" "$@" e2e/
