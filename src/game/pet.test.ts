import { describe, expect, it } from 'vitest';
import { DEFAULT_HABITAT_STATE } from './types';
import type { HabitatState } from './types';
import { beginStroke, blissOut, endPetting, petReaction, restHand, startPetting } from './pet';
import { describeSprig, startFeed } from './feed';

const at = (petting: HabitatState['petting']): HabitatState => ({
  ...DEFAULT_HABITAT_STATE,
  activeTray: petting === 'none' ? null : 'care',
  petting,
});

describe('petting lifecycle transitions', () => {
  it('startPetting activates Care with Sprig hoping for the hand', () => {
    const next = startPetting(DEFAULT_HABITAT_STATE);
    expect(next.activeTray).toBe('care');
    expect(next.petting).toBe('ready');
  });

  it('startPetting while already petting changes nothing', () => {
    const state = at('stroking');
    expect(startPetting(state)).toBe(state);
  });

  it('endPetting settles Sprig down from any phase', () => {
    for (const phase of ['ready', 'stroking', 'bliss'] as const) {
      const next = endPetting(at(phase));
      expect(next.petting).toBe('none');
      expect(next.activeTray).toBeNull();
    }
    const idle = at('none');
    expect(endPetting(idle)).toBe(idle); // no-op, same object
  });

  it('a stroke begins only from ready and rests back to ready', () => {
    expect(beginStroke(at('ready')).petting).toBe('stroking');
    expect(restHand(at('stroking')).petting).toBe('ready');
    for (const phase of ['none', 'stroking', 'bliss'] as const) {
      const state = at(phase);
      expect(beginStroke(state)).toBe(state);
    }
    for (const phase of ['none', 'ready', 'bliss'] as const) {
      const state = at(phase);
      expect(restHand(state)).toBe(state);
    }
  });

  it('bliss can only be reached once — repeat calls are no-ops', () => {
    const bliss = blissOut(at('stroking'));
    expect(bliss.petting).toBe('bliss');
    expect(blissOut(bliss)).toBe(bliss);
    const ready = at('ready');
    expect(blissOut(ready)).toBe(ready); // a pat must stroke first
  });

  it('feeding and petting stay mutually exclusive when composed', () => {
    // The App composes endPetting before startFeed (and vice versa); the
    // result must never carry both interactions at once.
    const petting = startPetting(DEFAULT_HABITAT_STATE);
    const fed = startFeed(endPetting(petting));
    expect(fed.activeTray).toBe('feed');
    expect(fed.petting).toBe('none');
    expect(fed.snack).toBe('ready');
  });
});

describe('petReaction', () => {
  it('maps each phase to the expected response', () => {
    expect(petReaction('none')).toBe('none');
    expect(petReaction('ready')).toBe('pet-ready');
    expect(petReaction('stroking')).toBe('pet-stroking');
    expect(petReaction('bliss')).toBe('pet-bliss');
  });
});

describe('describeSprig — petting moments', () => {
  it('describes each petting phase', () => {
    expect(describeSprig(at('ready'))).toMatch(/hoping to be petted/i);
    expect(describeSprig(at('stroking'))).toMatch(/leans into the petting/i);
    expect(describeSprig(at('bliss'))).toMatch(/blissful/i);
  });

  it('falls back to mood descriptions when no petting is happening', () => {
    expect(describeSprig(at('none'))).toBe('Sprig is calm.');
  });
});
