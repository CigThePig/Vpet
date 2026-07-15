import type { FeedFlourish, HabitatState, SnackPhase } from './types';

/**
 * Pure transitions for the feeding interaction.
 *
 * All feeding logic that decides "what happens next" lives here as plain
 * functions over HabitatState, so it can be unit-tested without a browser and
 * so the App component only wires events and timers to these transitions.
 * Every function is a no-op (returns the same object) when called from an
 * invalid phase — this is what guarantees a release can only succeed once and
 * that stray events can never wedge the interface.
 *
 * The berry is a physical object: releasing it anywhere but Sprig's mouth
 * DROPS it ('falling' — the Snack component runs the bounce/roll), and where
 * it lands decides the next phase via landSnack.
 */

/** How Sprig visibly responds to the snack. Drives face/posture in Creature. */
export type SnackReaction =
  | 'none'
  | 'notice' // snack exists / is being carried: eyes track it
  | 'anticipate' // snack is close: lean in, mouth open, sprout perks
  | 'eating' // munching a snack given to the mouth
  | 'gobbling' // bowing down to eat the snack off the floor
  | 'satisfied' // just ate: happy, crumbs, sprout bounce
  | 'missed' // snack tumbling across the floor: gentle, watchful
  | 'perched' // berry balanced on the head: cross-eyed wobble
  | 'teased' // the berry was waggled in its face: cheek-puff pout
  | 'yearning'; // resting berry out of reach: hopeful reach + hop

/** Every transition clears the transient flourish — a new phase is a new beat. */
const to = (state: HabitatState, snack: SnackPhase): HabitatState => ({
  ...state,
  snack,
  flourish: 'none',
});

/** Activate Feed: one snack appears at its resting spot. */
export function startFeed(state: HabitatState): HabitatState {
  if (state.activeTray === 'feed' && state.snack !== 'none') return state;
  return { ...to(state, 'ready'), activeTray: 'feed' };
}

/** Leave Feed mode (toggle off / switch category): the snack is put away. */
export function endFeed(state: HabitatState): HabitatState {
  if (state.activeTray !== 'feed' && state.snack === 'none') return state;
  return { ...to(state, 'none'), activeTray: null };
}

/**
 * The player picks the snack up — from the floor, off Sprig's head, or by
 * catching it mid-tumble.
 */
export function grabSnack(state: HabitatState): HabitatState {
  if (state.snack !== 'ready' && state.snack !== 'perched' && state.snack !== 'falling') {
    return state;
  }
  return to(state, 'held');
}

/**
 * The carried snack moves; `near` is true within Sprig's feeding area.
 * Unlike other transitions this PRESERVES the flourish: a tease-waggle
 * naturally crosses the near boundary, and the pout must survive that.
 */
export function moveSnack(state: HabitatState, near: boolean): HabitatState {
  const phase: SnackPhase = near ? 'held-near' : 'held';
  if (state.snack !== 'held' && state.snack !== 'held-near') return state;
  if (state.snack === phase) return state;
  return { ...state, snack: phase };
}

/**
 * The player lets go over Sprig's mouth. Success iff the snack was near
 * ('held-near'). Calling this in any other phase does nothing, so duplicate
 * pointerup/cancel events cannot double-feed.
 */
export function releaseSnack(state: HabitatState): HabitatState {
  if (state.snack === 'held-near') return to(state, 'eating');
  if (state.snack === 'held') return to(state, 'falling');
  return state;
}

/** Released away from Sprig / drag interrupted: the berry simply drops. */
export function dropSnack(state: HabitatState): HabitatState {
  if (state.snack !== 'held' && state.snack !== 'held-near') return state;
  return to(state, 'falling');
}

/** Released over Sprig's head: the berry balances there. */
export function perchSnack(state: HabitatState): HabitatState {
  if (state.snack !== 'held' && state.snack !== 'held-near') return state;
  return to(state, 'perched');
}

/** Sprig wobbles and shakes a perched berry off; it tumbles down. */
export function shakeOffSnack(state: HabitatState): HabitatState {
  if (state.snack !== 'perched') return state;
  return to(state, 'falling');
}

/**
 * The dropped berry stopped rolling. In front of Sprig's feet it gets
 * gobbled straight off the floor; anywhere else it simply rests where it
 * landed (and can be picked up again from there).
 */
export function landSnack(state: HabitatState, inFeedZone: boolean): HabitatState {
  if (state.snack !== 'falling') return state;
  return to(state, inFeedZone ? 'gobbling' : 'ready');
}

/** Munching (mouth-fed or floor-gobbled) finished: Sprig looks satisfied. */
export function finishEating(state: HabitatState): HabitatState {
  if (state.snack !== 'eating' && state.snack !== 'gobbling') return state;
  return to(state, 'eaten');
}

/** Layer a transient emotion (teased/yearning) over the current phase. */
export function setFlourish(state: HabitatState, flourish: FeedFlourish): HabitatState {
  if (state.flourish === flourish) return state;
  // Teasing only makes sense while the berry is carried; yearning only while
  // it rests. Clearing ('none') is always allowed.
  if (flourish === 'teased' && state.snack !== 'held' && state.snack !== 'held-near') return state;
  if (flourish === 'yearning' && state.snack !== 'ready') return state;
  return { ...state, flourish };
}

/** How Sprig should react to the current snack phase. */
export function snackReaction(phase: SnackPhase): SnackReaction {
  switch (phase) {
    case 'ready':
    case 'held':
      return 'notice';
    case 'held-near':
      return 'anticipate';
    case 'falling':
      return 'missed';
    case 'perched':
      return 'perched';
    case 'gobbling':
      return 'gobbling';
    case 'eating':
      return 'eating';
    case 'eaten':
      return 'satisfied';
    case 'none':
      return 'none';
  }
}

/** The reaction to render, including the transient flourish layer. */
export function effectiveReaction(state: HabitatState): SnackReaction {
  if (state.flourish === 'teased' && (state.snack === 'held' || state.snack === 'held-near')) {
    return 'teased';
  }
  if (state.flourish === 'yearning' && state.snack === 'ready') {
    return 'yearning';
  }
  return snackReaction(state.snack);
}

/**
 * One concise sentence describing Sprig's visible condition, for assistive
 * technology. The creature artwork itself stays aria-hidden; this is its
 * semantic equivalent. Not a live region — event announcements go through
 * the toast; this describes the current state for readers who look.
 */
export function describeSprig(state: HabitatState): string {
  // Petting and feeding are mutually exclusive (one tray category at a time),
  // so the petting moments can simply be described first.
  switch (state.petting) {
    case 'ready':
      return 'Sprig leans in, hoping to be petted.';
    case 'stroking':
      return 'Sprig closes its eyes and leans into the petting.';
    case 'bliss':
      return 'Sprig is blissful from all the petting.';
    case 'none':
      break;
  }
  switch (effectiveReaction(state)) {
    case 'notice':
      return 'Sprig notices the snack.';
    case 'anticipate':
      return 'Sprig leans in, mouth open, waiting for the snack.';
    case 'eating':
      return 'Sprig is munching the snack.';
    case 'gobbling':
      return 'Sprig gobbles the snack right off the floor.';
    case 'satisfied':
      return 'Sprig ate the snack and looks happy.';
    case 'missed':
      return 'Sprig watches the snack tumble across the floor.';
    case 'perched':
      return 'Sprig goes cross-eyed at the berry balanced on its head.';
    case 'teased':
      return 'Sprig puffs its cheeks — enough teasing!';
    case 'yearning':
      return 'Sprig reaches hopefully toward the snack.';
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
