# LCARS Server Monitor

Phase 2 front-end prototype for `tvserver`.

This is a self-contained HTML/CSS/JavaScript SPA. It deliberately uses only
development mock data and does not contact Mirakurun, EPGStation, Jellyfin,
Docker, or any other service.

The four fixed views rotate every 15 seconds:

1. SYSTEM
2. MIRAKURUN
3. EPGSTATION
4. JELLYFIN

Open `frontend/index.html` in a modern browser for design review. The target
viewport is 1024 x 600, with responsive layouts for 800 x 480 and 1280 x 800.

No deployment, service, browser kiosk, or system configuration is included in
this phase.

