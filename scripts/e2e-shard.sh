#!/usr/bin/env bash
# Prints the Maestro flow files of one CI shard: `maestro test $(bash scripts/e2e-shard.sh 1)`.
# The shards are split by measured length so they take about the same time, and the CI matrix
# in .github/workflows/ci.yml has one job per shard. It fails if a flow in e2e/ is in no shard
# or in more than one, so a new flow cannot be skipped by CI.
set -euo pipefail

shards=(
  "forgot-password recurring-task delete-account-onboarding password-toggle"
  "sign-up-create-household invite-link-signed-out create-complete-task shopping-realtime"
  "join-with-invite shopping delete-account shopping-offline"
)

expected="$(find e2e -maxdepth 1 -name '*.yaml' ! -name config.yaml -exec basename {} .yaml \; | sort)"
actual="$(printf '%s\n' ${shards[*]} | sort)"
if [ "$expected" != "$actual" ]; then
  echo "e2e-shard: the shards must list every flow in e2e/ exactly once:" >&2
  diff <(printf '%s\n' "$expected") <(printf '%s\n' "$actual") >&2 || true
  exit 1
fi

shard="${1:-}"
if ! [[ "$shard" =~ ^[0-9]+$ ]] || [ "$shard" -lt 1 ] || [ "$shard" -gt "${#shards[@]}" ]; then
  echo "usage: e2e-shard.sh 1..${#shards[@]}" >&2
  exit 1
fi
printf 'e2e/%s.yaml\n' ${shards[$((shard - 1))]}
