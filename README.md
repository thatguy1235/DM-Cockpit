# Dungeon Master OS

A private, local-first MVP for a live D&D table operating system with four synced interfaces: DM Cockpit, Player Mobile HUD, TV/Table Display, and Battlemap.

## Features

- DM command box with `SEARCH` and `CREATE` modes.
- SRD-only default seed cards plus space for user-authored private notes and homebrew.
- Structured JSON proposal queue for AI-assisted creation; changes must be approved or discarded by the DM before being applied.
- Live WebSocket state sync across the DM cockpit, player HUD, TV display, campaign log, and battlemap.
- Drag cards to the TV, campaign log, or battlemap drop zones.
- Simple grid battlemap with draggable PC/monster tokens and status markers.
- No external runtime dependencies; the MVP runs locally with Node's built-in HTTP server and a minimal WebSocket broadcaster.

## Run locally

```bash
npm run dev
```

Open <http://localhost:3001>.

## Legal/content posture

This MVP includes only short SRD-oriented reference summaries by default. It does not scrape D&D Beyond or bundle proprietary book text. Add campaign notes and homebrew manually for private local use.
