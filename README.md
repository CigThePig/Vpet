# Vpet — a tiny creature named Sprig

A mobile-first virtual-pet game in the spirit of Tamagotchi-style care games,
built as a static web app. The guiding principle:

> The creature may be mechanically simple, but interacting with it should feel
> exceptionally good.

**Current scope:** the technical and visual foundation — a polished static
habitat screen, a deterministic development-state system, an automated
screenshot / visual-review workflow designed so coding agents (and humans) can
iterate on the UI by looking at rendered pixels, not just source code — plus
the first direct-manipulation interaction: activate **Feed** and drag one
snack to Sprig (keyboard/screen-reader users press the snack instead). Broader
game systems (hunger simulation, persistence, progression…) are intentionally
not implemented yet. See [docs/product-vision.md](docs/product-vision.md).

## Stack

React · TypeScript · Vite · Playwright · Vitest · ESLint · Prettier.
No backend, no game engine, no UI component library, no runtime CDN
dependencies.

## Installation

```bash
npm ci                # reproducible install
```

Playwright needs a Chromium build. In the standard agent container one is
pre-installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Elsewhere run
once:

```bash
npx playwright install chromium
npx playwright install-deps chromium   # Linux only: host libraries
```

## Commands

| Command                      | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `npm run dev`                | Start the dev server                                            |
| `npm run build`              | Typecheck + production build to `dist/`                         |
| `npm run preview`            | Serve the production build                                      |
| `npm test`                   | Unit tests (Vitest)                                             |
| `npm run test:visual`        | Playwright interaction + screenshot-comparison tests            |
| `npm run test:visual:update` | Regenerate approved visual baselines (`ux/baseline/`)           |
| `npm run ux:capture`         | Capture all dev states as PNGs into `ux/current/`               |
| `npm run ux:report`          | Build the labelled contact sheet `ux/reports/contact-sheet.png` |
| `npm run ux:motion`          | Record the real feed drag: `ux/motion/` video + filmstrip       |
| `npm run lint`               | ESLint                                                          |
| `npm run format`             | Prettier                                                        |

## Deterministic visual states

The interface can be forced into exact, reproducible states via query
parameters (full reference in [docs/visual-testing.md](docs/visual-testing.md)):

```
/?state=idle|happy|hungry|tired|dirty|night|care-tray
/?state=feed-ready|feed-hover|feed-eaten|feed-returning
/?debug=touch-targets     outline every hit area
/?motion=reduced          force reduced motion
/?insets=1                simulate notch / home-indicator safe areas
/?dev=1                   show the hidden dev panel
```

## Screenshot workflow

1. `npm run ux:capture` — renders every scenario in `tests/visual/scenarios.json`
   to `ux/current/*.png` (deviceScaleFactor 2, animations frozen, waits for the
   app's `html[data-app-ready="true"]` signal).
2. `npm run ux:report` — combines them into `ux/reports/contact-sheet.png`.
3. **Open the images and look at them.** This project treats screenshots as
   the primary evidence that UI work is correct — see [AGENTS.md](AGENTS.md).

`ux/current/`, `ux/diffs/` and `ux/reports/` are generated and git-ignored;
`ux/baseline/` (the approved look) is committed.

## Updating visual baselines

When an intentional visual change makes `npm run test:visual` fail:

1. Inspect the diff images Playwright wrote under `ux/diffs/`.
2. Confirm every difference is intended (recapture + contact sheet help).
3. `npm run test:visual:update`
4. Review the changed PNGs in `ux/baseline/` before committing them.

Never widen `maxDiffPixelRatio` in `playwright.config.ts` to make a failing
comparison pass.

## GitHub Pages deployment

`.github/workflows/deploy.yml` lints, unit-tests, builds, and deploys `dist/`
via the official Pages actions on every push to `main`.

One-time setup: repository **Settings → Pages → Build and deployment →
Source: “GitHub Actions”**. No extra secrets are required.

**Repository-name note:** `vite.config.ts` uses `base: './'` (relative asset
URLs), so the build works from any Pages subdirectory regardless of the
repository's final name. If the app ever adopts history-based routing or needs
absolute URLs, switch to `base: '/<repo-name>/'` and update it if the repo is
renamed. Visual tests are run locally / in the dev container, not in the
deploy workflow — see the comment in the workflow and
[docs/visual-testing.md](docs/visual-testing.md).

## Architecture notes

```
src/
  app/          App shell: wires dev options, state, toast; desktop dev frame
  components/   Presentational habitat pieces (Habitat, Creature, CareTray…)
  game/         Interface-facing state types + deterministic fixtures
  dev/          Query-parameter dev-state system + hidden dev panel
  styles/       Design tokens (tokens.css) + global rules (global.css)
tests/visual/   Playwright specs + the scenario matrix (scenarios.json)
scripts/        capture.mjs (screenshots), contact-sheet.mjs (report)
ux/             baseline/ (committed) · current/ diffs/ reports/ (generated)
docs/           product vision, visual testing, decision log
```

Key conventions:

- **Design tokens only** — colours, spacing, radii, shadows, durations,
  z-layers all come from `src/styles/tokens.css`. Organic SVG artwork
  (creature/prop fills) is the one sanctioned exception.
- **Simulation vs presentation** — `HabitatState` describes what the screen
  looks like; there is deliberately no simulation logic yet.
- **Screenshot-ready signal** — the app sets `data-app-ready="true"` on
  `<html>` after its first painted frame; all tooling waits for it.
- **Motion policy** — every nonessential animation is disabled both by the OS
  `prefers-reduced-motion` setting and by `?motion=reduced`.

Read [AGENTS.md](AGENTS.md) before making UI changes.
