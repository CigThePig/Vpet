import { describe, expect, it } from 'vitest';
import { DEFAULT_DEV_OPTIONS, devOptionsToSearch, parseDevOptions } from './devState';

describe('parseDevOptions', () => {
  it('returns defaults for an empty query', () => {
    expect(parseDevOptions('')).toEqual(DEFAULT_DEV_OPTIONS);
  });

  it('selects each known fixture', () => {
    for (const name of ['idle', 'happy', 'hungry', 'tired', 'dirty', 'night', 'care-tray']) {
      expect(parseDevOptions(`?state=${name}`).fixture).toBe(name);
    }
  });

  it('falls back to idle for unknown or malicious state values', () => {
    expect(parseDevOptions('?state=bogus').fixture).toBe('idle');
    expect(parseDevOptions('?state=<script>').fixture).toBe('idle');
    expect(parseDevOptions('?state=').fixture).toBe('idle');
  });

  it('parses debug and motion toggles', () => {
    const options = parseDevOptions(
      '?state=night&debug=touch-targets&motion=reduced&insets=1&dev=1',
    );
    expect(options).toEqual({
      fixture: 'night',
      debugTouchTargets: true,
      forceReducedMotion: true,
      simulateInsets: true,
      showDevPanel: true,
    });
  });

  it('ignores unknown toggle values', () => {
    expect(parseDevOptions('?debug=everything').debugTouchTargets).toBe(false);
    expect(parseDevOptions('?motion=off').forceReducedMotion).toBe(false);
  });
});

describe('devOptionsToSearch', () => {
  it('round-trips every option combination it produces', () => {
    const combos = [
      { ...DEFAULT_DEV_OPTIONS },
      { ...DEFAULT_DEV_OPTIONS, fixture: 'night' as const },
      { ...DEFAULT_DEV_OPTIONS, debugTouchTargets: true },
      { ...DEFAULT_DEV_OPTIONS, fixture: 'care-tray' as const, forceReducedMotion: true },
      { ...DEFAULT_DEV_OPTIONS, simulateInsets: true, showDevPanel: true },
    ];
    for (const combo of combos) {
      expect(parseDevOptions(devOptionsToSearch(combo))).toEqual(combo);
    }
  });
});
