#!/bin/sh
# Browser client for the manual and systemd kiosk sessions.
set -eu
xset s off
xset -dpms
xset s noblank
openbox &
unclutter -idle 0.2 -root &
# Web application mode removes Epiphany's address bar and browser controls.
# This Epiphany version requires an explicit, existing profile for that mode.
dbus-run-session -- epiphany --application-mode --profile=/var/lib/lcars-monitor/org.gnome.Epiphany.WebApp_lcars http://127.0.0.1:8765 &
browser_pid=$!
# Epiphany creates its window before it is ready to receive keyboard input.
# Let it finish mapping, then toggle its own kiosk fullscreen mode.
sleep 6
window=$(xdotool getactivewindow 2>/dev/null || true)
if [ -n "$window" ] && ! xprop -id "$window" _NET_WM_STATE 2>/dev/null | grep -q '_NET_WM_STATE_FULLSCREEN'; then
    xdotool key --clearmodifiers F11
fi
wait "$browser_pid"
