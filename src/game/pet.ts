import type { HabitatState, PetPhase } from './types';

/**
 * Pure transitions for the petting interaction (the Care category).
 *
 * Petting follows the same pattern as feeding (src/game/feed.ts): every
 * function is a plain guarded transition over HabitatState, a no-op (same
 * object) from any invalid phase, so duplicate or stray events can never
 * wedge the interface, and the App component only wires gestures and timers
 * to these transitions.
 *
 * The interaction itself: activating Care makes Sprig hopeful ('ready').
 * Pressing on Sprig starts a stroke ('stroking' — lean-in, eyes closed);
 * lifting the hand rests back to 'ready'. Enough accumulated stroking — or a
 * simple pat (tap / keyboard activation) — melts Sprig into 'bliss', which
 * lingers briefly before Care mode ends. Stroke progress is a live gesture
 * detail and lives in the PetZone component, never in HabitatState, so
 * fixtures stay enumerable.
 */

/** How Sprig visibly responds to petting. Drives face/posture in Creature. */
export type PetReaction =
  | 'none'
  | 'pet-ready' // Care active: leaning in, hoping for the hand
  | 'pet-stroking' // being petted: eyes closed, leaning into the strokes
  | 'pet-bliss'; // thoroughly petted: grin, wiggle, floating hearts

/** Activate Care: Sprig perks up, hoping to be petted. */
export function startPetting(state: HabitatState): HabitatState {
  if (state.activeTray === 'care' && state.petting !== 'none') return state;
  return { ...state, activeTray: 'care', petting: 'ready' };
}

/** Leave Care mode (toggle off / switch category): Sprig settles down. */
export function endPetting(state: HabitatState): HabitatState {
  if (state.activeTray !== 'care' && state.petting === 'none') return state;
  return { ...state, activeTray: null, petting: 'none' };
}

/** The hand comes down on Sprig: a stroke begins. */
export function beginStroke(state: HabitatState): HabitatState {
  if (state.petting !== 'ready') return state;
  return { ...state, petting: 'stroking' };
}

/** The hand lifts before Sprig has had enough: back to hopeful. */
export function restHand(state: HabitatState): HabitatState {
  if (state.petting !== 'stroking') return state;
  return { ...state, petting: 'ready' };
}

/**
 * Enough petting: Sprig melts. Only reachable from 'stroking', so duplicate
 * gesture events or stacked pat timers can never double-bliss.
 */
export function blissOut(state: HabitatState): HabitatState {
  if (state.petting !== 'stroking') return state;
  return { ...state, petting: 'bliss' };
}

/** How Sprig should react to the current petting phase. */
export function petReaction(phase: PetPhase): PetReaction {
  switch (phase) {
    case 'ready':
      return 'pet-ready';
    case 'stroking':
      return 'pet-stroking';
    case 'bliss':
      return 'pet-bliss';
    case 'none':
      return 'none';
  }
}
