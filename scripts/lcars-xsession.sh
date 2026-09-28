#!/bin/sh
# Manual Phase 4 test session. This is not a systemd unit and has no autostart.
set -eu

python3 /opt/lcars-monitor/backend/server.py &
backend_pid=$!
cleanup() {
    kill "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

xset s off
xset -dpms
xset s noblank
openbox &
unclutter -idle 0.2 -root &
exec chromium-browser \
    --kiosk \
    --start-fullscreen \
    --no-first-run \
    --no-default-browser-check \
    --disable-session-crashed-bubble \
    --incognito \
    http://127.0.0.1:8765

