import { describe, expect, it } from 'vitest';
import { DEFAULT_HABITAT_STATE } from './types';
import type { HabitatState } from './types';
import {
  describeSprig,
  dropSnack,
  effectiveReaction,
  endFeed,
  finishEating,
  grabSnack,
  landSnack,
  moveSnack,
  perchSnack,
  releaseSnack,
  setFlourish,
  shakeOffSnack,
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
    for (const phase of [
      'ready',
      'held',
      'held-near',
      'falling',
      'perched',
      'gobbling',
      'eating',
      'eaten',
    ] as const) {
      const next = endFeed(at(phase));
      expect(next.snack).toBe('none');
      expect(next.activeTray).toBeNull();
    }
  });

  it('the snack can be grabbed at rest, on the head, or caught mid-fall', () => {
    expect(grabSnack(at('ready')).snack).toBe('held');
    expect(grabSnack(at('perched')).snack).toBe('held');
    expect(grabSnack(at('falling')).snack).toBe('held');
    for (const phase of ['none', 'held', 'held-near', 'gobbling', 'eaten'] as const) {
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

  it('release near Sprig feeds; release away drops the berry', () => {
    expect(releaseSnack(at('held-near')).snack).toBe('eating');
    expect(releaseSnack(at('held')).snack).toBe('falling');
    expect(dropSnack(at('held')).snack).toBe('falling');
    expect(dropSnack(at('held-near')).snack).toBe('falling');
  });

  it('release can only succeed once — repeat calls are no-ops', () => {
    const eating = releaseSnack(at('held-near'));
    expect(releaseSnack(eating)).toBe(eating);
    const eaten = finishEating(eating);
    expect(releaseSnack(eaten)).toBe(eaten);
  });

  it('a dropped berry lands where it stopped: rest or floor-gobble', () => {
    expect(landSnack(at('falling'), false).snack).toBe('ready');
    expect(landSnack(at('falling'), true).snack).toBe('gobbling');
    const ready = at('ready');
    expect(landSnack(ready, true)).toBe(ready); // only a falling berry lands
  });

  it('a head drop perches; Sprig shakes it back into a tumble', () => {
    expect(perchSnack(at('held')).snack).toBe('perched');
    expect(perchSnack(at('held-near')).snack).toBe('perched');
    expect(shakeOffSnack(at('perched')).snack).toBe('falling');
    const ready = at('ready');
    expect(perchSnack(ready)).toBe(ready);
    expect(shakeOffSnack(ready)).toBe(ready);
  });

  it('eating and gobbling both finish into the satisfied state exactly once', () => {
    const eaten = finishEating(at('eating'));
    expect(eaten.snack).toBe('eaten');
    expect(finishEating(eaten)).toBe(eaten);
    expect(finishEating(at('gobbling')).snack).toBe('eaten');
  });

  it('interrupted drags become a physical drop, never a stuck state', () => {
    expect(dropSnack(at('held')).snack).toBe('falling');
    expect(landSnack(dropSnack(at('held')), false).snack).toBe('ready');
    const ready = at('ready');
    expect(dropSnack(ready)).toBe(ready);
  });
});

describe('flourishes (teased / yearning)', () => {
  it('teasing only applies while the berry is carried', () => {
    expect(setFlourish(at('held'), 'teased').flourish).toBe('teased');
    expect(setFlourish(at('held-near'), 'teased').flourish).toBe('teased');
    const ready = at('ready');
    expect(setFlourish(ready, 'teased')).toBe(ready);
  });

  it('yearning only applies while the berry rests', () => {
    expect(setFlourish(at('ready'), 'yearning').flourish).toBe('yearning');
    const held = at('held');
    expect(setFlourish(held, 'yearning')).toBe(held);
  });

  it('lifecycle transitions clear the flourish — except the carry itself', () => {
    const teased = setFlourish(at('held'), 'teased');
    // Crossing the near boundary mid-waggle must NOT interrupt the pout…
    expect(moveSnack(teased, true).flourish).toBe('teased');
    // …but a real transition does.
    expect(dropSnack(teased).flourish).toBe('none');
    const yearning = setFlourish(at('ready'), 'yearning');
    expect(grabSnack(yearning).flourish).toBe('none');
  });

  it('effectiveReaction layers the flourish over the phase', () => {
    expect(effectiveReaction(setFlourish(at('held'), 'teased'))).toBe('teased');
    expect(effectiveReaction(setFlourish(at('ready'), 'yearning'))).toBe('yearning');
    expect(effectiveReaction(at('held'))).toBe('notice');
  });
});

describe('snackReaction', () => {
  it('maps each phase to the expected response', () => {
    expect(snackReaction('none')).toBe('none');
    expect(snackReaction('ready')).toBe('notice');
    expect(snackReaction('held')).toBe('notice');
    expect(snackReaction('held-near')).toBe('anticipate');
    expect(snackReaction('falling')).toBe('missed');
    expect(snackReaction('perched')).toBe('perched');
    expect(snackReaction('gobbling')).toBe('gobbling');
    expect(snackReaction('eating')).toBe('eating');
    expect(snackReaction('eaten')).toBe('satisfied');
  });
});

describe('describeSprig', () => {
  it('describes the feeding moments', () => {
    expect(describeSprig(at('ready'))).toMatch(/notices the snack/i);
    expect(describeSprig(at('held-near'))).toMatch(/waiting for the snack/i);
    expect(describeSprig(at('falling'))).toMatch(/tumble/i);
    expect(describeSprig(at('perched'))).toMatch(/cross-eyed.*head/i);
    expect(describeSprig(at('gobbling'))).toMatch(/off the floor/i);
    expect(describeSprig(at('eating'))).toMatch(/munching/i);
    expect(describeSprig(at('eaten'))).toMatch(/ate the snack and looks happy/i);
    expect(describeSprig(setFlourish(at('held'), 'teased'))).toMatch(/teasing/i);
    expect(describeSprig(setFlourish(at('ready'), 'yearning'))).toMatch(/reaches hopefully/i);
  });

  it('falls back to mood descriptions when no snack is present', () => {
    expect(describeSprig(DEFAULT_HABITAT_STATE)).toBe('Sprig is calm.');
    expect(describeSprig({ ...DEFAULT_HABITAT_STATE, mood: 'happy' })).toMatch(/happy/i);
    expect(describeSprig({ ...DEFAULT_HABITAT_STATE, sleeping: true })).toMatch(/asleep/i);
    expect(describeSprig({ ...DEFAULT_HABITAT_STATE, mood: 'hungry' })).toMatch(/hungry/i);
  });
});
