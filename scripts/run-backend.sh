#!/bin/sh
# systemd supplies jellyfin.env as an ephemeral credential, never from Git.
set -eu
set -a
. "${CREDENTIALS_DIRECTORY:?missing systemd credentials}/jellyfin.env"
set +a
exec /usr/bin/python3 /opt/lcars-monitor/backend/server.py

