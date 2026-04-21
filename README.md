# ircc-news

Telegram alerts for IRCC (Canada immigration) updates:

- 🍁 Express Entry draws — new ITA rounds with CRS cutoff + invitation count
- 📰 IRCC news releases — policy changes, program announcements

## Setup

1. **Create a bot**: open Telegram, message `@BotFather`, run `/newbot`, follow prompts. Copy the token.
2. **Get your chat ID**: already known if you're using your own account — or message `@userinfobot` to confirm.
3. **Local env**:
   ```bash
   cp .env.example .env
   # paste the token into .env
   npm install
   ```
4. **First run (silent baseline)**:
   ```bash
   npm run check
   ```
   First run records "what's already out there" into `state.json` without spamming you.
5. **Second run onward** — only fires when something new appears.

## Dry run (no Telegram send)

```bash
npm run check:dry
```

Logs what *would* have been sent.

## GitHub Actions (always-on)

The included workflow (`.github/workflows/check.yml`) runs every 30 min on GitHub's infra.

1. Push this repo to GitHub.
2. Settings → Secrets and variables → Actions → add:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
3. The workflow commits `state.json` back after each run so history is preserved.

## Files

```
src/index.js              orchestrator — runs all sources once
src/telegram.js           Telegram Bot API sender (HTML parse mode)
src/state.js              state.json read/write
src/sources/
  express-entry.js        EE draws (official IRCC JSON feed)
  news.js                 IRCC Atom news feed
state.json                last-seen tracker (committed; persists across runs)
```

## Adding a source

Drop a new file in `src/sources/`, export `fetchX`, `formatX`, `diffX`, wire it
into `src/index.js`. Each source owns its slice of `state.json`.
