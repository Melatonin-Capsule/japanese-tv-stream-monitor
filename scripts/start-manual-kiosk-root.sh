#!/bin/sh
# Phase 4 only: starts an Xorg test on VT7. No persistent service is created.
set -eu
exec xinit /opt/lcars-monitor/scripts/lcars-root-xsession.sh -- :0 vt7 -nolisten tcp

