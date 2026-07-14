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
export type FixtureName = 'idle' | 'happy' | 'hungry' | 'tired' | 'dirty' | 'night' | 'care-tray';

export const FIXTURES: Record<FixtureName, HabitatState> = {
  idle: { ...DEFAULT_HABITAT_STATE },
  happy: { ...DEFAULT_HABITAT_STATE, mood: 'happy' },
  hungry: { ...DEFAULT_HABITAT_STATE, mood: 'hungry' },
  tired: { ...DEFAULT_HABITAT_STATE, mood: 'tired' },
  dirty: { ...DEFAULT_HABITAT_STATE, dirty: true },
  night: { ...DEFAULT_HABITAT_STATE, timeOfDay: 'night', sleeping: true },
  'care-tray': { ...DEFAULT_HABITAT_STATE, activeTray: 'feed' },
};

export const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];

export function isFixtureName(value: string): value is FixtureName {
  return value in FIXTURES;
}
