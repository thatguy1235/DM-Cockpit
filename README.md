# Dungeon Master OS

A private, local-first MVP for a live D&D table operating system with four synced interfaces: DM Cockpit, Player Mobile HUD, TV/Table Display, and Battlemap.

## Features

- AI Command Center with `SEARCH`, `CREATE`, `MODIFY`, and `IMAGE PROMPT` modes over a shared Card model.
- Server-side OpenAI Responses API integration with a mock AI fallback when `OPENAI_API_KEY` is not configured or an API call fails.
- SRD-only default seed cards plus space for user-authored private notes and homebrew.
- Every rule, NPC, item, spell, player, monster, token, scene, note, condition, and proposal is represented as a Card.
- OpenAI/mock AI creates structured JSON proposal cards for character features, items, monsters, scene image prompts, and rule summaries.
- AI never directly changes game state; proposal cards must be approved, edited, or discarded by the DM before being applied.
- Live WebSocket state sync across the DM cockpit, player HUD, TV display, campaign log, and battlemap.
- Drag cards to the TV, campaign log, or battlemap drop zones, or use each card's Send to TV / Send to Player / Add to Campaign Log buttons.
- Simple grid battlemap with draggable PC/monster token cards and status markers.
- Card history log records sends, proposal creation, approvals, discards, and token movement.
- No external runtime dependencies; the MVP runs locally with Node's built-in HTTP server and `fetch`.

## Run locally

```bash
git clone https://github.com/thatguy1235/DM-Cockpit.git
cd DM-Cockpit
npm run dev
```

Open <http://localhost:3001>.

## Optional: use real OpenAI AI instead of mock fallback

The app works without an API key. If no key is present, AI commands still create proposal cards with the mock fallback and the UI shows a small `Mock AI fallback used` note.

### 1. Create an OpenAI API key

1. Go to <https://platform.openai.com/api-keys>.
2. Sign in or create an OpenAI account.
3. Click **Create new secret key**.
4. Copy the key immediately. You will not be able to see it again after closing the dialog.

### 2. Add the key to `.env`

Copy the example file:

```bash
cp .env.example .env
```

Open `.env` in a text editor and replace the placeholder:

```bash
OPENAI_API_KEY=sk-your-real-key-here
OPENAI_MODEL=gpt-5.5
```

Do not share this file. `.env` is ignored by git so your API key should not be committed.

### 3. Start the app

```bash
npm run dev
```

Open <http://localhost:3001>, choose `CREATE`, `MODIFY`, or `IMAGE PROMPT`, type a command, and submit it.

### 4. Tell whether real AI or mock fallback is being used

- If the request uses OpenAI, the AI Command Center status says `OpenAI provider used` with the configured model.
- If the API key is missing or the API call fails, the status says `Mock AI fallback used`, and the proposal card includes a fallback note.

## Legal/content posture

This MVP includes only short SRD-oriented reference summaries by default. It does not scrape D&D Beyond or bundle proprietary book text. Add campaign notes and homebrew manually for private local use.
