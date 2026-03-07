#!/usr/bin/env bash
set -euo pipefail

UI_PID=""
BRIDGE_PID=""

cleanup() {
  if [[ -n "$BRIDGE_PID" ]] && kill -0 "$BRIDGE_PID" 2>/dev/null; then
    kill "$BRIDGE_PID" 2>/dev/null || true
  fi
  if [[ -n "$UI_PID" ]] && kill -0 "$UI_PID" 2>/dev/null; then
    kill "$UI_PID" 2>/dev/null || true
  fi
  wait || true
}
trap cleanup EXIT INT TERM

export MILADY_API_BIND="${MILADY_API_BIND:-0.0.0.0}"
export MILADY_PORT="${MILADY_PORT:-2138}"
export PORT="${PORT:-2139}"
export BRIDGE_PORT="${BRIDGE_PORT:-31337}"
export BRIDGE_COMPAT_PORT="${BRIDGE_COMPAT_PORT:-18790}"

node milady.mjs start &
UI_PID=$!

tsx deploy/cloud-agent-entrypoint.ts &
BRIDGE_PID=$!

wait -n "$UI_PID" "$BRIDGE_PID"
STATUS=$?
cleanup
exit "$STATUS"
