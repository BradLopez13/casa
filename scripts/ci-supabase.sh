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
    nohup bash "$0" run > /dev/null 2>&1 &
    ;;
  run)
    # Up to three tries. The public image registry sometimes refuses an anonymous pull ("Data
    # limit exceeded", "toomanyrequests") and one shard failed on it while the others came up;
    # the images already pulled stay, so a later try only fetches the rest. Any other failure is
    # not retried.
    code=1
    for attempt in 1 2 3; do
      if supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta >> "$log" 2>&1; then
        code=0
        break
      else
        code=$?
      fi
      grep -qiE "data limit exceeded|toomanyrequests|rate limit" "$log" || break
      [ "$attempt" = 3 ] && break
      echo "ci-supabase: the image registry refused a pull; trying again in $((attempt * 30)) s" >> "$log"
      supabase stop --no-backup >> "$log" 2>&1 || true
      sleep $((attempt * 30))
    done
    echo "$code" > "$status"
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
    echo "usage: ci-supabase.sh start|run|wait" >&2
    exit 1
    ;;
esac
