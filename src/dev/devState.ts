import type { FixtureName } from '../game/fixtures';
import { isFixtureName } from '../game/fixtures';

/**
 * Development-state selection via URL query parameters.
 *
 * These parameters exist so humans and coding agents can force the interface
 * into an exact, reproducible visual state (they also drive the Playwright
 * screenshot harness):
 *
 *   ?state=idle|happy|hungry|tired|dirty|night|care-tray
 *         |feed-ready|feed-hover|feed-eaten|feed-perched
 *         |feed-gobbling|feed-teased|feed-yearning          visual fixture
 *   ?debug=touch-targets                                    outline all hit areas
 *   ?motion=reduced                                         force reduced motion
 *   ?insets=1                                               simulate device safe areas
 *   ?dev=1                                                  show the dev panel
 *
 * Unknown values are ignored so a bad URL can never break the app.
 */
export interface DevOptions {
  fixture: FixtureName;
  debugTouchTargets: boolean;
  forceReducedMotion: boolean;
  simulateInsets: boolean;
  showDevPanel: boolean;
}

export const DEFAULT_DEV_OPTIONS: DevOptions = {
  fixture: 'idle',
  debugTouchTargets: false,
  forceReducedMotion: false,
  simulateInsets: false,
  showDevPanel: false,
};

export function parseDevOptions(search: string): DevOptions {
  const params = new URLSearchParams(search);
  const state = params.get('state') ?? '';
  return {
    fixture: isFixtureName(state) ? state : 'idle',
    debugTouchTargets: params.get('debug') === 'touch-targets',
    forceReducedMotion: params.get('motion') === 'reduced',
    simulateInsets: params.get('insets') === '1',
    showDevPanel: params.get('dev') === '1',
  };
}

/** Build the query string that reproduces a given set of options. */
export function devOptionsToSearch(options: Partial<DevOptions>): string {
  const params = new URLSearchParams();
  if (options.fixture && options.fixture !== 'idle') params.set('state', options.fixture);
  if (options.debugTouchTargets) params.set('debug', 'touch-targets');
  if (options.forceReducedMotion) params.set('motion', 'reduced');
  if (options.simulateInsets) params.set('insets', '1');
  if (options.showDevPanel) params.set('dev', '1');
  const s = params.toString();
  return s ? `?${s}` : '';
}
