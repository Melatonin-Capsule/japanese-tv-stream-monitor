#!/bin/sh
# Browser client for the manual and systemd kiosk sessions.
set -eu
xset s off
xset -dpms
xset s noblank
openbox &
unclutter -idle 0.2 -root &
# surf is a dedicated, chrome-free WebKit kiosk. -F requests X11 fullscreen.
surf -F http://127.0.0.1:8765 &
browser_pid=$!
# Epiphany creates its window before it is ready to receive keyboard input.
# Let it finish mapping, then toggle its own kiosk fullscreen mode.
sleep 6
window=$(xdotool getactivewindow 2>/dev/null || true)
if [ -n "$window" ] && ! xprop -id "$window" _NET_WM_STATE 2>/dev/null | grep -q '_NET_WM_STATE_FULLSCREEN'; then
    xdotool key --clearmodifiers F11
fi
wait "$browser_pid"
