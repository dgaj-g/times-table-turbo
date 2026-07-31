# Jarlath and Anya’s Times Table Turbo

A fast, touch-first times-tables game for Jarlath and Anya to practise the
2–12 tables alone or together on their iPads.

## The game

- 60-second rounds with three hearts
- separate Fact Family Flight mode connecting multiplication and division
- large on-screen keypad for iPad and other touch devices
- combo bonuses, time rewards and friendly consequences
- six unlockable awards, stars and a device-local high score
- optional arcade sound effects
- live two-iPad Race mode with a shared countdown and realtime scores
- turn-taking Team Turbo mode with shared hearts and a shared score
- compulsory end-of-round correction review and retry quiz
- simple five-character room codes with no child accounts or chat
- installable from Safari with **Add to Home Screen**
- offline solo replay after the first visit

Solo progress is stored only in the browser on the device. Live rooms use
anonymous Firebase sessions, expire after two hours and contain only gameplay
state. There are no named accounts, ads, chat or analytics.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Use `npm run build` for the Sites deployment build, or `npm run build:pages`
to create the static GitHub Pages site in `docs/`.
