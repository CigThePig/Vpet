# Instructions for AI coding agents

This project is an experiment in screenshot-driven UI development. The rules
below are not optional ceremony — they are how quality is maintained here.

## The core loop for any UI change

1. **Reproduce first.** Run the relevant visual scenario _before_ editing:
   `npm run ux:capture` (all states) or `npm run dev` and open the state URL
   (e.g. `/?state=hungry`). The full state list lives in
   `tests/visual/scenarios.json` and README.md.
2. **Capture and inspect screenshots.** Generate `ux/current/` and the contact
   sheet (`npm run ux:report`), then open the PNG files and _look_ at them.
   The accessibility tree, CSS source, and passing tests are not a substitute
   for seeing the rendered interface.
3. **Diagnose visible issues before changing code.** Name what is wrong in the
   image (spacing, hierarchy, contrast, artifact) so you can verify the fix.
4. **Make the change.**
5. **Recapture the same states** with the same commands.
6. **Inspect the updated screenshots and the diffs.** Run
   `npm run test:visual`; when it fails, read the diff images under
   `ux/diffs/` before deciding whether the change is a regression or an
   intended update.
7. **Test more than one viewport.** At minimum: 320×568, 393×851, and
   851×393 (landscape). All are in the capture matrix already.
8. **Check accessibility and console errors.** The interaction tests cover
   accessible names, 44px touch targets, focus visibility, and console
   errors — keep them passing, and check anything new you add.
9. **Do not claim completion because tests pass.** Completion means you have
   looked at the rendered result and it is visually correct.

## Hard rules

Do **not**, without explicit maintainer direction:

- Replace or drift the visual identity (warm terrarium, deep moss/charcoal
  tones, amber lamp light, cream creature — see docs/product-vision.md).
- Introduce a UI component framework or CSS framework of any kind.
- Add permanent status dashboards, meters, or badge/reward chrome — the
  creature's animation and behaviour communicate state.
- Add features outside the requested scope of your task.
- Hide regressions by loosening `maxDiffPixelRatio` or other visual
  thresholds.
- Delete or skip tests to make a task pass.
- Regenerate visual baselines (`npm run test:visual:update`) without first
  inspecting the diffs and confirming every change is intended.

## Project-specific mechanics you need to know

- **Deterministic states**: `?state=<fixture>` forces the UI into a known
  frame (`src/game/fixtures.ts`). Never rely on timers or randomness for a
  screenshot; if you add ambient variation, it must be deterministic
  (fixed positions/delays) and frozen by the `animations: 'disabled'`
  screenshot option.
- **Ready signal**: wait for `html[data-app-ready="true"]` before
  screenshotting (helpers in `tests/visual/helpers.ts` do this).
- **Design tokens**: use the custom properties in `src/styles/tokens.css`.
  Adding a raw colour/spacing value to a component stylesheet needs a reason
  (SVG illustration fills are the standing exception).
- **Motion**: gate any new nonessential animation so it is disabled under
  `prefers-reduced-motion` and `?motion=reduced` (the global rules in
  `src/styles/global.css` already kill `animation`/`transition` durations —
  verify your effect actually stops).
- **Touch targets**: interactive elements must be ≥ 44×44 CSS px; verify with
  `/?debug=touch-targets` in a screenshot, not just by reading CSS.
- **Safe areas**: layout must respect `--safe-*` tokens; screenshot with
  `?insets=1` to prove it.
- **Baselines are Linux-Chromium**: they are rendered by the pinned Playwright
  Chromium in this container. Do not commit baselines produced by a different
  browser/OS.

## Definition of done for UI tasks

- `npm run lint`, `npm test`, `npm run test:visual`, and `npm run build` all
  pass.
- `npm run ux:capture` + `npm run ux:report` succeed and you have inspected
  the contact sheet.
- No console errors in any captured state.
- Documentation (README/docs) still matches the implementation.
