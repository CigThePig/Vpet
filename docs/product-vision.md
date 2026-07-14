# Product vision

## The core experience

A tiny virtual creature — Sprig, a sprout-topped gumdrop — living in a warm,
softly lit den. The interface should feel like a miniature terrarium or a
beautifully manufactured digital toy: calm, tactile, and alive. Opening the
app should feel like checking on something small that is glad you came.

> The creature may be mechanically simple, but interacting with it should feel
> exceptionally good.

## Design principles

- **Direct manipulation over menus.** The long-term interaction model is
  touching the world itself: dragging food to the creature, petting it,
  pulling a blanket over it, picking up messes, moving toys, tapping objects
  in the room. Buttons exist only as an entry point into those gestures.
- **Visual and behavioural communication over numbers.** Mood, hunger, and
  tiredness are read from the creature's face, posture, idle motion, and the
  room itself (light, mess, time of day) — not from meters or dashboards.
  Numerical status panels are explicitly out of bounds.
- **Calm hierarchy.** One clear focal point (the creature), quiet supporting
  props, minimal permanent text, restrained decoration.
- **Warmth without sugar.** Deep moss/charcoal room tones with amber lamp
  light; characterful but not childish; masculine-or-neutral rather than
  saccharine.
- **Tactility.** Controls respond immediately (press scale, glow), feel like
  ceramic/wood/cloth surfaces, and never depend on hover.
- **Respect the device.** Portrait-first, safe-area aware, no accidental
  scrolling, reduced-motion honoured, 44px touch targets.

## Long-term interaction ideas (not commitments)

- Drag a snack from the tray to Sprig's mouth; it leans toward the food.
- Scratch/pet with small circular strokes; slow blink and lean-in response.
- Drag a blanket over Sprig at night; it settles and sleeps.
- Pick up messes by dragging them to a bin that appears on grab.
- A ball that can be flicked; Sprig watches and shuffles after it.
- Room items (lamp, window blind) that can be toggled by tapping them.
- A journal recording small moments rather than scores.

## Current non-goals

Feeding mechanics, inventory, persistence, progression/evolution, currency,
collections, notifications, sound, and any server component. The foundation
must stay small and polished rather than broad and unfinished.

## Simulation state vs interface presentation

`HabitatState` (`src/game/types.ts`) describes **what the screen looks like**:
mood, time of day, sleeping, dirty, active tray category. It is set from
deterministic fixtures today and will eventually be _derived from_ a
simulation — but the simulation (timers, decay curves, persistence) is a
separate future layer. Keeping presentation state pure and enumerable is what
makes the screenshot harness deterministic, so future simulation work must
preserve this boundary: the sim produces a `HabitatState`; the components only
consume it.
