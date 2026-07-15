import type { HabitatState } from './types';
import { DEFAULT_HABITAT_STATE } from './types';

/**
 * Deterministic visual fixtures.
 *
 * Each named fixture forces the interface into one known, reproducible look.
 * They are selected with `?state=<name>` (see src/dev/devState.ts) and are the
 * contract between the app and the screenshot harness: the same fixture must
 * always render the same frame.
 */
export type FixtureName =
  | 'idle'
  | 'happy'
  | 'hungry'
  | 'tired'
  | 'dirty'
  | 'night'
  | 'care-tray'
  | 'feed-ready'
  | 'feed-hover'
  | 'feed-eaten'
  | 'feed-perched'
  | 'feed-gobbling'
  | 'feed-teased'
  | 'feed-yearning'
  | 'pet-ready'
  | 'pet-stroking'
  | 'pet-bliss';

export const FIXTURES: Record<FixtureName, HabitatState> = {
  idle: { ...DEFAULT_HABITAT_STATE },
  happy: { ...DEFAULT_HABITAT_STATE, mood: 'happy' },
  hungry: { ...DEFAULT_HABITAT_STATE, mood: 'hungry' },
  tired: { ...DEFAULT_HABITAT_STATE, mood: 'tired' },
  dirty: { ...DEFAULT_HABITAT_STATE, dirty: true },
  night: { ...DEFAULT_HABITAT_STATE, timeOfDay: 'night', sleeping: true },
  'care-tray': { ...DEFAULT_HABITAT_STATE, activeTray: 'feed' },
  // Feeding interaction, frozen at its four visually distinct moments.
  // Fixture-initialized phases never auto-advance (App timers only start
  // from live events), so each renders one stable frame. The Snack component
  // shows held/returning phases at fixed poses when no live drag is running.
  'feed-ready': { ...DEFAULT_HABITAT_STATE, activeTray: 'feed', snack: 'ready' },
  'feed-hover': { ...DEFAULT_HABITAT_STATE, activeTray: 'feed', snack: 'held-near' },
  'feed-eaten': { ...DEFAULT_HABITAT_STATE, activeTray: 'feed', snack: 'eaten' },
  'feed-perched': { ...DEFAULT_HABITAT_STATE, activeTray: 'feed', snack: 'perched' },
  'feed-gobbling': { ...DEFAULT_HABITAT_STATE, activeTray: 'feed', snack: 'gobbling' },
  'feed-teased': {
    ...DEFAULT_HABITAT_STATE,
    activeTray: 'feed',
    snack: 'held-near',
    flourish: 'teased',
  },
  'feed-yearning': {
    ...DEFAULT_HABITAT_STATE,
    activeTray: 'feed',
    snack: 'ready',
    flourish: 'yearning',
  },
  // Petting interaction, frozen at its three visually distinct moments.
  // Same determinism contract as the feed fixtures: App timers only start
  // from live events, so none of these auto-advance; the stroking lean
  // renders its centred default because no live gesture writes --pet-x.
  'pet-ready': { ...DEFAULT_HABITAT_STATE, activeTray: 'care', petting: 'ready' },
  'pet-stroking': { ...DEFAULT_HABITAT_STATE, activeTray: 'care', petting: 'stroking' },
  'pet-bliss': { ...DEFAULT_HABITAT_STATE, activeTray: 'care', petting: 'bliss' },
};

export const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];

export function isFixtureName(value: string): value is FixtureName {
  return value in FIXTURES;
}
