#!/bin/sh
# Browser client for the manual and systemd kiosk sessions.
set -eu
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
