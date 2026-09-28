#!/bin/sh
# Browser client for the manual and systemd kiosk sessions.
set -eu
xset s off
xset -dpms
xset s noblank
openbox &
unclutter -idle 0.2 -root &
epiphany --application-mode --incognito-mode http://127.0.0.1:8765 &
browser_pid=$!
sleep 2
wmctrl -r :ACTIVE: -b add,fullscreen 2>/dev/null || true
wait "$browser_pid"
