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

## Release channel for the iPads

The existing iPad Home Screen apps were installed from
`https://dgaj-g.github.io/times-table-turbo/`. That GitHub Pages origin is the
canonical PWA release channel. Publishing only to the separate Sites project
does not update those installed apps and must not be treated as an iPad
release.

Run `npm test` before every release. It builds both hosting targets and verifies
that the generated `docs/` PWA contains the current app, manifest and service
worker. Commit the resulting `docs/` files with the source changes and push
`main`; GitHub Pages serves `main/docs` automatically.

The service worker uses a network-first strategy, immediately activates new
workers and bypasses the browser cache when checking `sw.js`. This preserves
offline fallback while allowing future releases to reach the existing icons.
Keep the GitHub Pages origin unchanged so device-local progress in
`times-table-turbo-progress` remains available.
