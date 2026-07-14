# Decision log

Major technical and design decisions from project initialization (2026-07),
including rejected alternatives.

## D1 — Vite + React + TypeScript, no game engine

React's declarative rendering maps cleanly onto "presentation state in,
habitat out", which is exactly what a deterministic screenshot harness needs.
**Rejected:** Phaser/PixiJS (a full engine buys sprite batching we don't need
and costs DOM accessibility, semantic controls, and easy CSS theming);
plain-DOM/no-framework (state→UI wiring would be reinvented badly); Svelte
(fine technically, but React has the broadest agent familiarity, which matters
for an agent-operated repo).

## D2 — `base: './'` for GitHub Pages

Relative asset URLs survive any repository rename and work from any Pages
subdirectory with zero configuration. **Rejected:** `base: '/Vpet/'`
(breaks silently if the repo is renamed and complicates local preview).
Trade-off: if the app ever adopts history-based routing, relative base breaks
on nested routes — we use query parameters only, and the README documents the
switch needed if that changes.

## D3 — Creature and props as inline SVG, room as layered CSS

Inline SVG gives a characterful, resolution-independent creature whose face
and posture are plain JSX branches (`data-mood` etc.), diffable in review and
controllable from fixtures. CSS layers (gradients + positioned elements) keep
the room responsive across viewports. **Rejected:** raster sprites (large,
hard to re-pose, not diffable); canvas (loses accessibility tree and CSS
reduced-motion handling); emoji placeholder (explicitly banned by the brief).

## D4 — Dev states via query parameters, panel hidden behind `?dev=1`

URLs are the most reliable interface for Playwright and for agents: every
state is one navigation, reproducible from the address alone, and invisible in
production use. **Rejected:** dev routes (needs a router we otherwise don't);
keyboard-toggled panel (not reachable from a URL, flaky in automation);
localStorage flags (hidden state that breaks reproducibility).

## D5 — Contact sheet rendered by Chromium, not a native image library

The contact sheet is an HTML grid screenshotted by the same Playwright
Chromium that captures the states. Zero additional dependencies, trivially
labelled/styled, resolution preserved via deviceScaleFactor 2.
**Rejected:** `sharp` (native binary, heavyweight for compositing);
`jimp`/`pngjs` compositing (pure-JS but means hand-writing layout and text
rendering). Documented in docs/visual-testing.md.

## D6 — Baselines committed, generated artefacts ignored

`ux/baseline/` is committed (dpr 1, Linux-Chromium) so regressions are caught
by `npm run test:visual`; `ux/current|diffs|reports` are git-ignored build
products. Visual tests are excluded from the Pages deploy workflow because
fresh CI runners rasterize fonts/gradients slightly differently than the
pinned dev-container Chromium; running them there would force either flaky
builds or meaninglessly loose thresholds. **Rejected:** running visual tests
in CI with a fat threshold (hides real regressions — banned by AGENTS.md).

## D7 — Tolerance `maxDiffPixelRatio: 0.002`

≈670 pixels on a 393×851 frame absorbs anti-aliasing jitter while still
failing on any visible layout shift (a 1px-wide full-height line is ~850 px).
**Rejected:** exact match (flaky), 1%+ ratios (a moved button could pass).

## D8 — Presentation state only, no simulation

`HabitatState` is a small enumerable record (mood/time/sleeping/dirty/tray)
set from named fixtures. Simulation (decay timers, persistence) is deferred
and must later _produce_ a `HabitatState` rather than leak timers into
components — this boundary is what keeps screenshots deterministic.
**Rejected:** starting a "small" simulation now (would immediately fight the
determinism requirement and expand scope).

## D9 — Visual direction: nocturnal terrarium, warm lamp key light

Deep moss/charcoal walls, wooden floor, one warm amber key light, cream
creature as the brightest large shape (guaranteeing focal hierarchy), dock as
a floating ceramic tray, minimal text in small caps. Night mode re-lights the
same room rather than being a different theme. **Rejected:** bright pastel
daylight look (drifts sugary, fights the "premium handheld toy" brief); flat
dashboard chrome (explicitly banned); skeuomorphic Tamagotchi shell (legally
and aesthetically off-limits).

## D10 — System font stack

`system-ui` everywhere: zero network dependency, native feel per platform, and
the UI is deliberately text-light so typographic branding is not load-bearing.
Trade-off: minor cross-platform screenshot variance — accepted and noted in
docs/visual-testing.md.

## D11 — Landscape gets a docked side tray, not a redesigned scene

Short-landscape viewports move the care tray to a right-hand column and hide
the shelf; the room stays intact. Landscape is a supported-but-secondary
orientation per the brief ("does not completely break"), so it shares one
layout with media-query adjustments instead of a parallel composition.

## D12 — Playwright pinned to the container's Chromium (1.56.x)

`@playwright/test` is pinned exactly so its expected Chromium revision matches
the pre-installed `/opt/pw-browsers/chromium-1194`, keeping installs
network-light and baselines stable. Upgrading Playwright therefore means
regenerating baselines in the same change.

## D13 — Feeding drag: Pointer Events + capture, position via direct DOM

The snack (`src/components/Snack.tsx`) uses Pointer Events with
`setPointerCapture`, so one code path serves mouse/touch/pen, the drag
survives fast movement and leaving the element's bounds, and
`pointercancel`/`lostpointercapture`/Escape/window-blur all funnel into one
cancel routine (gentle roll-back — the interface can never stick in a drag).
During a drag, position is written straight to `style.transform`; React state
changes only on lifecycle transitions, never per move. **Rejected:** HTML5
drag-and-drop (no touch, ghost images); mouse+touch event pairs (duplicated
logic, ghost clicks); per-move `setState` (re-renders the whole habitat at
pointer rate).

## D14 — Snack lifecycle as pure transitions in presentation state

`HabitatState` gained one field, `snack: SnackPhase` (`none → ready → held ⇄
held-near → eating → eaten`, with `returning` for misses). All transitions
are pure guarded functions in `src/game/feed.ts` — a release can only succeed
from `held-near`, so duplicate events can't double-feed. App timers
(flight/munch/linger/return) start only from user events, never from
rendering a state, which is why fixture-initialized phases hold still for
screenshots. **Rejected:** a generalized item/inventory/physics system (one
snack doesn't need it; the pure-transition pattern is the reusable part);
a state-machine library (seven phases don't justify a dependency).

## D15 — Accessibility: activation-equivalent, not drag-emulation

A press that doesn't travel (keyboard Enter/Space, VoiceOver double-tap,
quick touch tap) gives the snack directly: it glides to Sprig and triggers
the exact same transition, reactions and announcement as a drag. The snack is
a real `<button>` ("Give snack to Sprig"); Feed activation moves focus to it,
and it hands focus back to Feed when consumed or dismissed (Escape).
Sprig's condition is one visually-hidden sentence (`describeSprig`), and only
meaningful results are announced through the existing toast live region —
never continuous pointer movement. **Rejected:** arrow-key "move the snack"
emulation (slow, inequivalent, and harder to keep unstuck).

## D16 — Motion evidence is recorded, not asserted

`npm run ux:motion` replays the real pointer interaction and records a WebM
video plus a labelled key-frame filmstrip into git-ignored `ux/motion/`.
Motion quality is reviewed by humans/agents looking at these artifacts;
regression protection stays with the deterministic frozen fixtures.
**Rejected:** video-diff testing (flaky, heavyweight) and adding an
ffmpeg/image dependency (Playwright's Chromium already renders the filmstrip).
