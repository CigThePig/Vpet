import type { HabitatState, SnackPhase } from './types';

/**
 * Pure transitions for the feeding interaction.
 *
 * All feeding logic that decides "what happens next" lives here as plain
 * functions over HabitatState, so it can be unit-tested without a browser and
 * so the App component only wires events and timers to these transitions.
 * Every function is a no-op (returns the same object) when called from an
 * invalid phase — this is what guarantees a release can only succeed once and
 * that stray events can never wedge the interface.
 */

/** How Sprig visibly responds to the snack. Drives face/posture in Creature. */
export type SnackReaction =
  | 'none'
  | 'notice' // snack exists / is being carried: eyes track it
  | 'anticipate' // snack is close: lean in, mouth open, sprout perks
  | 'eating' // munching
  | 'satisfied' // just ate: happy, crumbs, sprout bounce
  | 'missed'; // snack rolled away: gentle, watchful

/** Activate Feed: one snack appears at its resting spot. */
export function startFeed(state: HabitatState): HabitatState {
  if (state.activeTray === 'feed' && state.snack !== 'none') return state;
  return { ...state, activeTray: 'feed', snack: 'ready' };
}

/** Leave Feed mode (toggle off / switch category): the snack is put away. */
export function endFeed(state: HabitatState): HabitatState {
  if (state.activeTray !== 'feed' && state.snack === 'none') return state;
  return { ...state, activeTray: null, snack: 'none' };
}

/** The player picks the snack up. Only a resting snack can be grabbed. */
export function grabSnack(state: HabitatState): HabitatState {
  if (state.snack !== 'ready') return state;
  return { ...state, snack: 'held' };
}

/** The carried snack moves; `near` is true within Sprig's feeding area. */
export function moveSnack(state: HabitatState, near: boolean): HabitatState {
  const phase: SnackPhase = near ? 'held-near' : 'held';
  if (state.snack !== 'held' && state.snack !== 'held-near') return state;
  if (state.snack === phase) return state;
  return { ...state, snack: phase };
}

/**
 * The player lets go. Success iff the snack was near Sprig ('held-near');
 * otherwise it rolls back. Calling this in any other phase does nothing, so
 * duplicate pointerup/cancel events cannot double-feed.
 */
export function releaseSnack(state: HabitatState): HabitatState {
  if (state.snack === 'held-near') return { ...state, snack: 'eating' };
  if (state.snack === 'held') return { ...state, snack: 'returning' };
  return state;
}

/** A drag was interrupted (pointer cancel, Escape, blur): roll gently back. */
export function cancelDrag(state: HabitatState): HabitatState {
  if (state.snack !== 'held' && state.snack !== 'held-near') return state;
  return { ...state, snack: 'returning' };
}

/** The rolled-back snack has settled at its resting spot. */
export function settleSnack(state: HabitatState): HabitatState {
  if (state.snack !== 'returning') return state;
  return { ...state, snack: 'ready' };
}

/** Munching finished: Sprig looks satisfied. */
export function finishEating(state: HabitatState): HabitatState {
  if (state.snack !== 'eating') return state;
  return { ...state, snack: 'eaten' };
}

/** How Sprig should react to the current snack phase. */
export function snackReaction(phase: SnackPhase): SnackReaction {
  switch (phase) {
    case 'ready':
    case 'held':
      return 'notice';
    case 'held-near':
      return 'anticipate';
    case 'eating':
      return 'eating';
    case 'eaten':
      return 'satisfied';
    case 'returning':
      return 'missed';
    case 'none':
      return 'none';
  }
}

/**
 * One concise sentence describing Sprig's visible condition, for assistive
 * technology. The creature artwork itself stays aria-hidden; this is its
 * semantic equivalent. Not a live region — event announcements go through
 * the toast; this describes the current state for readers who look.
 */
export function describeSprig(state: HabitatState): string {
  const reaction = snackReaction(state.snack);
  switch (reaction) {
    case 'notice':
      return 'Sprig notices the snack.';
    case 'anticipate':
      return 'Sprig leans in, mouth open, waiting for the snack.';
    case 'eating':
      return 'Sprig is munching the snack.';
    case 'satisfied':
      return 'Sprig ate the snack and looks happy.';
    case 'missed':
      return 'Sprig watches the snack roll back.';
    case 'none':
      break;
  }
  if (state.sleeping) return 'Sprig is asleep.';
  if (state.mood === 'happy') return 'Sprig is happy.';
  if (state.mood === 'hungry') return 'Sprig looks a little hungry.';
  if (state.mood === 'tired') return 'Sprig is sleepy.';
  if (state.dirty) return 'Sprig could use a clean-up.';
  return 'Sprig is calm.';
}
