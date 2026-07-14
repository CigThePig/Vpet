import { describe, expect, it } from 'vitest';
import { DEFAULT_HABITAT_STATE } from './types';
import type { HabitatState } from './types';
import {
  cancelDrag,
  describeSprig,
  endFeed,
  finishEating,
  grabSnack,
  moveSnack,
  releaseSnack,
  settleSnack,
  snackReaction,
  startFeed,
} from './feed';

const at = (snack: HabitatState['snack']): HabitatState => ({
  ...DEFAULT_HABITAT_STATE,
  activeTray: snack === 'none' ? null : 'feed',
  snack,
});

describe('feed lifecycle transitions', () => {
  it('startFeed makes exactly one snack available', () => {
    const next = startFeed(DEFAULT_HABITAT_STATE);
    expect(next.activeTray).toBe('feed');
    expect(next.snack).toBe('ready');
  });

  it('startFeed while already feeding changes nothing', () => {
    const state = at('held');
    expect(startFeed(state)).toBe(state);
  });

  it('endFeed puts the snack away from any phase', () => {
    for (const phase of ['ready', 'held', 'held-near', 'returning', 'eating', 'eaten'] as const) {
      const next = endFeed(at(phase));
      expect(next.snack).toBe('none');
      expect(next.activeTray).toBeNull();
    }
  });

  it('only a resting snack can be grabbed', () => {
    expect(grabSnack(at('ready')).snack).toBe('held');
    for (const phase of ['none', 'held', 'held-near', 'returning', 'eating', 'eaten'] as const) {
      const state = at(phase);
      expect(grabSnack(state)).toBe(state); // no-op, same object
    }
  });

  it('moveSnack toggles held ⇄ held-near and ignores other phases', () => {
    expect(moveSnack(at('held'), true).snack).toBe('held-near');
    expect(moveSnack(at('held-near'), false).snack).toBe('held');
    const held = at('held');
    expect(moveSnack(held, false)).toBe(held); // no change, same object
    const ready = at('ready');
    expect(moveSnack(ready, true)).toBe(ready);
  });

  it('release near Sprig feeds; release away rolls back', () => {
    expect(releaseSnack(at('held-near')).snack).toBe('eating');
    expect(releaseSnack(at('held')).snack).toBe('returning');
  });

  it('release can only succeed once — repeat calls are no-ops', () => {
    const eating = releaseSnack(at('held-near'));
    expect(releaseSnack(eating)).toBe(eating);
    const eaten = finishEating(eating);
    expect(releaseSnack(eaten)).toBe(eaten);
  });

  it('a cancelled drag rolls back to a recoverable state', () => {
    expect(cancelDrag(at('held')).snack).toBe('returning');
    expect(cancelDrag(at('held-near')).snack).toBe('returning');
    expect(settleSnack(cancelDrag(at('held'))).snack).toBe('ready');
    const ready = at('ready');
    expect(cancelDrag(ready)).toBe(ready);
  });

  it('eating finishes into the satisfied state exactly once', () => {
    const eaten = finishEating(at('eating'));
    expect(eaten.snack).toBe('eaten');
    expect(finishEating(eaten)).toBe(eaten);
  });
});

describe('snackReaction', () => {
  it('maps each phase to the expected response', () => {
    expect(snackReaction('none')).toBe('none');
    expect(snackReaction('ready')).toBe('notice');
    expect(snackReaction('held')).toBe('notice');
    expect(snackReaction('held-near')).toBe('anticipate');
    expect(snackReaction('eating')).toBe('eating');
    expect(snackReaction('eaten')).toBe('satisfied');
    expect(snackReaction('returning')).toBe('missed');
  });
});

describe('describeSprig', () => {
  it('describes the feeding moments', () => {
    expect(describeSprig(at('ready'))).toMatch(/notices the snack/i);
    expect(describeSprig(at('held-near'))).toMatch(/waiting for the snack/i);
    expect(describeSprig(at('eating'))).toMatch(/munching/i);
    expect(describeSprig(at('eaten'))).toMatch(/ate the snack and looks happy/i);
    expect(describeSprig(at('returning'))).toMatch(/roll back/i);
  });

  it('falls back to mood descriptions when no snack is present', () => {
    expect(describeSprig(DEFAULT_HABITAT_STATE)).toBe('Sprig is calm.');
    expect(describeSprig({ ...DEFAULT_HABITAT_STATE, mood: 'happy' })).toMatch(/happy/i);
    expect(describeSprig({ ...DEFAULT_HABITAT_STATE, sleeping: true })).toMatch(/asleep/i);
    expect(describeSprig({ ...DEFAULT_HABITAT_STATE, mood: 'hungry' })).toMatch(/hungry/i);
  });
});
