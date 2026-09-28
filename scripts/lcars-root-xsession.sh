#!/bin/sh
# Root opens the unused virtual terminal; all LCARS clients stay unprivileged.
set -eu
xhost +SI:localuser:lcars
exec runuser -u lcars -- env -i HOME=/var/lib/lcars-monitor PATH=/usr/local/bin:/usr/bin:/bin DISPLAY="$DISPLAY" XDG_RUNTIME_DIR=/run/lcars \
    /opt/lcars-monitor/scripts/lcars-xsession.sh
