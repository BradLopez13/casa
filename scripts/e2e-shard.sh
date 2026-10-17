#!/usr/bin/env bash
# Prints the Maestro flow files of one CI shard: `maestro test $(bash scripts/e2e-shard.sh 1)`.
# The shards are split by measured length so they take about the same time. It fails if a flow
# in e2e/ is in no shard or in more than one, so a new flow cannot be skipped by CI.
set -euo pipefail

shard_1="forgot-password sign-up-create-household recurring-task delete-account-onboarding
  shopping-realtime password-toggle"
shard_2="join-with-invite invite-link-signed-out shopping create-complete-task delete-account
  shopping-offline"

expected="$(find e2e -maxdepth 1 -name '*.yaml' ! -name config.yaml -exec basename {} .yaml \; | sort)"
actual="$(printf '%s\n' $shard_1 $shard_2 | sort)"
if [ "$expected" != "$actual" ]; then
  echo "e2e-shard: the shards must list every flow in e2e/ exactly once:" >&2
  diff <(printf '%s\n' "$expected") <(printf '%s\n' "$actual") >&2 || true
  exit 1
fi

case "${1:-}" in
  1) flows="$shard_1" ;;
  2) flows="$shard_2" ;;
  *)
    echo "usage: e2e-shard.sh 1|2" >&2
    exit 1
    ;;
esac
printf 'e2e/%s.yaml\n' $flows
