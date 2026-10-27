#!/usr/bin/env bash
# CI only. `start` launches the local Supabase stack in the background, so it comes up while the
# job does other work (installing, booting the emulator); `wait` blocks until it is up, prints
# its output and fails if it failed. `db` starts only the database, in the foreground (the db
# job). Supabase CLI must be on the PATH.
set -euo pipefail

log=.supabase-start.log
status=.supabase-start.status

# Runs a Supabase start, appending to `$1`, up to four times. The public image registry sometimes
# refuses an anonymous pull ("Data limit exceeded", "toomanyrequests"): it failed one e2e shard
# twice while the other jobs came up. The images already pulled stay, so a later try only fetches
# the rest. Any other failure is not retried. Returns the last exit code.
with_retries() {
  local out="$1"
  shift
  local code=1
  for attempt in 1 2 3 4; do
    if "$@" >> "$out" 2>&1; then
      return 0
    else
      code=$?
    fi
    grep -qiE "data limit exceeded|toomanyrequests|rate limit" "$out" || return "$code"
    [ "$attempt" = 4 ] && return "$code"
    echo "ci-supabase: the image registry refused a pull; trying again in $((attempt * 30)) s" >> "$out"
    supabase stop --no-backup >> "$out" 2>&1 || true
    sleep $((attempt * 30))
  done
  return "$code"
}

case "${1:-}" in
  start)
    rm -f "$log" "$status"
    nohup bash "$0" run > /dev/null 2>&1 &
    ;;
  run)
    code=0
    with_retries "$log" supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta || code=$?
    echo "$code" > "$status"
    ;;
  db)
    rm -f "$log"
    code=0
    with_retries "$log" supabase db start || code=$?
    cat "$log"
    exit "$code"
    ;;
  wait)
    for _ in $(seq 1 600); do
      [ -f "$status" ] && break
      sleep 1
    done
    cat "$log" || true
    if [ ! -f "$status" ]; then
      echo "ci-supabase: supabase start did not finish in 10 minutes" >&2
      exit 1
    fi
    exit "$(cat "$status")"
    ;;
  *)
    echo "usage: ci-supabase.sh start|run|wait|db" >&2
    exit 1
    ;;
esac
