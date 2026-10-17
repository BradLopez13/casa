#!/usr/bin/env bash
# CI only. `start` launches the local Supabase stack in the background, so it comes up while the
# job does other work (installing, booting the emulator); `wait` blocks until it is up, prints
# its output and fails if it failed. Supabase CLI must be on the PATH.
set -euo pipefail

log=.supabase-start.log
status=.supabase-start.status

case "${1:-}" in
  start)
    rm -f "$log" "$status"
    nohup bash -c "supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta > $log 2>&1; echo \$? > $status" > /dev/null 2>&1 &
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
    echo "usage: ci-supabase.sh start|wait" >&2
    exit 1
    ;;
esac
