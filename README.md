# LCARS Server Monitor

Phase 3 local-only monitor for `tvserver`.

The browser is a self-contained HTML/CSS/JavaScript SPA.  The Python standard-
library backend serves it and exposes one local-only endpoint: `/api/status`.
It reads system files plus the read-only Mirakurun and EPGStation APIs. It does
not access Docker or Threadfin.

The four fixed views rotate every 15 seconds:

1. SYSTEM
2. MIRAKURUN
3. EPGSTATION
4. JELLYFIN

For a temporary manual test, run `python3 backend/server.py`, then open
`http://127.0.0.1:8765`. The target viewport is 1024 x 600, with responsive
layouts for 800 x 480 and 1280 x 800. This does not install or enable a service.

Phase 4 also provides `scripts/start-manual-kiosk-root.sh`. It creates a
temporary Xorg session on VT7, disables blanking only inside that X session,
starts the local backend, then launches Chromium in kiosk mode. Root is used
only to open the virtual terminal; Openbox, Chromium, and the backend run as
`kai`. Closing Chromium ends the manual test and stops its backend. It is not
an automatic-start mechanism.

Jellyfin remains `UNAVAILABLE` until `JELLYFIN_API_KEY` is supplied via a
restricted, non-repository configuration source. Never put that key in this
repository, frontend files, URLs, or logs.

No deployment, service unit, browser kiosk, or system configuration is included
in this phase.
