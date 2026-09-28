#!/bin/sh
# Root opens the unused virtual terminal; all LCARS clients stay unprivileged.
set -eu
xhost +SI:localuser:kai
exec runuser -u kai -- env DISPLAY="$DISPLAY" XDG_RUNTIME_DIR=/run/user/1000 \
    /opt/lcars-monitor/scripts/lcars-xsession.sh

