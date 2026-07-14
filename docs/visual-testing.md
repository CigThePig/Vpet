# Visual testing

## How deterministic states work

The app never renders from timers or randomness. `?state=<name>` selects a
fixture from `src/game/fixtures.ts` (`idle`, `happy`, `hungry`, `tired`,
`dirty`, `night`, `care-tray`), which fully determines the frame. Extra
parameters compose with it:

| Parameter              | Effect                                      |
| ---------------------- | ------------------------------------------- |
| `?debug=touch-targets` | Outline all interactive hit areas + legend  |
| `?motion=reduced`      | Force the reduced-motion presentation       |
| `?insets=1`            | Simulate notch/home-indicator safe areas    |
| `?dev=1`               | Show the hidden dev panel (links to states) |

Ambient life (motes, breathing, sway) uses fixed positions and CSS animation
delays, so freezing animations always yields the same pixels. When the app has
committed and painted its first frame it sets `data-app-ready="true"` on
`<html>` — every capture and test waits for that signal instead of sleeping.

## How screenshots are captured

`npm run ux:capture` (`scripts/capture.mjs`) starts an in-process Vite dev
server, launches the pinned Playwright Chromium, and renders every entry of
`tests/visual/scenarios.json` (13 scenarios: three idle viewports, all moods,
night, care-tray, touch-target overlay, simulated insets, landscape, reduced
motion). Each page is captured with `animations: 'disabled'` (CSS animations
rewound to a deterministic state) at deviceScaleFactor 2, using system fonts
only. Output: `ux/current/<name>.png` plus `ux/current/manifest.json`.

## How the contact sheet is produced

`npm run ux:report` (`scripts/contact-sheet.mjs`) reads the manifest, embeds
every PNG as a data URI in a labelled HTML grid, and renders that page to
`ux/reports/contact-sheet.png` with the same Chromium (images shown at half
CSS size, captured at deviceScaleFactor 2, so original resolution is
preserved). This avoids any native image-processing dependency; the one
"image library" is the browser we already ship.

## How baselines are approved

Playwright's `toHaveScreenshot` compares against committed baselines in
`ux/baseline/` (`snapshotPathTemplate` in `playwright.config.ts`). Tolerance
is `maxDiffPixelRatio: 0.002` (≈670 px on a 393×851 frame) — enough to absorb
anti-aliasing noise, small enough to catch real layout shifts. To approve an
intentional change:

```bash
npm run test:visual              # fails, writes diffs
# inspect ux/diffs/**/ *-diff.png and *-actual.png
npm run test:visual:update       # rewrites ux/baseline/
# review the changed baselines, then commit them
```

Never loosen the threshold to make a comparison pass.

## How to inspect diffs

Failed comparisons write three images per test into `ux/diffs/<test>/`:
`*-expected.png`, `*-actual.png`, and `*-diff.png` (changed pixels
highlighted). Read all three: the diff shows _where_, expected/actual show
_what_. The HTML report (`npx playwright show-report`) is also available.

## Known limitations of browser emulation

- Baselines are **Linux + pinned Chromium** renders. Other OSes, browser
  versions, or GPU stacks rasterize text and gradients slightly differently —
  that is why visual tests do not run in the GitHub Actions deploy workflow.
- Emulated viewports do not reproduce real browser chrome (collapsing URL
  bars), real `env(safe-area-inset-*)` values (we simulate them via
  `?insets=1`), OLED colour profiles, or true touch latency.
- WebKit/Safari rendering is not covered at all yet; iOS is a target
  platform, so this is a known gap.
- `animations: 'disabled'` shows animation start states; it cannot judge how
  motion _feels_.

## Why occasional real-device screenshots are still necessary

Colour temperature, physical pixel density, safe-area behaviour with the
dynamic island / gesture bar, browser-chrome resizing, and touch ergonomics
(thumb reach on a real hand) can only be judged on hardware. Before any visual
milestone is called finished, load the deployed Pages URL on at least one real
Android and one real iOS phone and compare against the contact sheet.
