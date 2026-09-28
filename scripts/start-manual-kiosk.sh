#!/bin/sh
# Run only interactively during Phase 4. No service is installed or enabled.
set -eu
exec startx /opt/lcars-monitor/scripts/lcars-xsession.sh -- :0 vt7 -nolisten tcp

