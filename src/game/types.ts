/**
 * Lightweight interface-facing state types.
 *
 * These describe what the habitat LOOKS like, not a simulation. Real
 * simulation state (hunger meters, timers, persistence) is intentionally out
 * of scope for now — see docs/product-vision.md for the distinction between
 * simulation state and interface presentation.
 */

/** How the creature is feeling — drives its face, posture and idle motion. */
export type Mood = 'content' | 'happy' | 'hungry' | 'tired';

/** Ambient lighting of the habitat. */
export type TimeOfDay = 'day' | 'night';

/** The four future interaction categories in the care tray. */
export type TrayCategory = 'feed' | 'care' | 'play' | 'room';

export const TRAY_CATEGORIES: readonly TrayCategory[] = ['feed', 'care', 'play', 'room'];

/**
 * Lifecycle of the one snack the Feed mode offers. Presentation only: each
 * phase is a distinct, statically renderable frame (fixtures can start in any
 * of them). Live gestures move between phases via the pure transitions in
 * src/game/feed.ts.
 *
 *   none → ready → held ⇄ held-near → eating → eaten → none
 *            ↑        ↓ (released away — the berry is a physical thing)
 *            |     falling (drop, bounce, roll…)
 *            |        ↓ lands…
 *            +──── anywhere on the floor        → ready (where it landed)
 *            |     in front of Sprig's feet     → gobbling → eaten
 *            |     on Sprig's head              → perched → falling (shaken off)
 */
export type SnackPhase =
  'none' | 'ready' | 'held' | 'held-near' | 'falling' | 'perched' | 'gobbling' | 'eating' | 'eaten';

/**
 * Short-lived emotional flourishes layered over the snack lifecycle: teased
 * (the berry was waggled in front of Sprig's face) and yearning (the berry
 * has been resting on the floor and Sprig reaches for it). Presentation
 * state like everything else, so fixtures can freeze them.
 */
export type FeedFlourish = 'none' | 'teased' | 'yearning';

/**
 * Lifecycle of the petting interaction the Care mode offers. Presentation
 * only, like the snack: each phase is a distinct, statically renderable
 * frame. Live gestures move between phases via the pure transitions in
 * src/game/pet.ts.
 *
 *   none → ready ⇄ stroking → bliss → none
 *            (hand rests)  (enough strokes / a pat)
 */
export type PetPhase = 'none' | 'ready' | 'stroking' | 'bliss';

/** Everything the habitat screen needs to render one deterministic frame. */
export interface HabitatState {
  mood: Mood;
  timeOfDay: TimeOfDay;
  /** Creature is asleep (eyes closed, zzz drift). Usually paired with night. */
  sleeping: boolean;
  /** The habitat needs cleaning: smudges on the creature, a mess on the floor. */
  dirty: boolean;
  /** Which tray category is active, or null when the tray is at rest. */
  activeTray: TrayCategory | null;
  /** Where the Feed snack is in its lifecycle ('none' when Feed is inactive). */
  snack: SnackPhase;
  /** Transient snack-play emotion (teased/yearning) layered over the phase. */
  flourish: FeedFlourish;
  /** Where the Care petting is in its lifecycle ('none' when Care is inactive). */
  petting: PetPhase;
}

export const DEFAULT_HABITAT_STATE: HabitatState = {
  mood: 'content',
  timeOfDay: 'day',
  sleeping: false,
  dirty: false,
  activeTray: null,
  snack: 'none',
  flourish: 'none',
  petting: 'none',
};
