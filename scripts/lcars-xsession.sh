#!/bin/sh
# Browser client for the manual and systemd kiosk sessions.
set -eu
xset s off
xset -dpms
xset s noblank
openbox &
unclutter -idle 0.2 -root &
dbus-run-session -- epiphany --private-instance http://127.0.0.1:8765 &
browser_pid=$!
for attempt in 1 2 3 4 5 6 7 8; do
    window=$(xdotool search --onlyvisible --name 'LCARS Server Monitor' 2>/dev/null | head -n 1 || true)
    if [ -n "$window" ]; then
        if ! xprop -id "$window" _NET_WM_STATE 2>/dev/null | grep -q '_NET_WM_STATE_FULLSCREEN'; then
            xdotool windowactivate --sync "$window"
            xdotool key --clearmodifiers F11
        fi
        break
    fi
    sleep 1
done
wait "$browser_pid"
