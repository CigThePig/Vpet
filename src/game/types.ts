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
}

export const DEFAULT_HABITAT_STATE: HabitatState = {
  mood: 'content',
  timeOfDay: 'day',
  sleeping: false,
  dirty: false,
  activeTray: null,
};
