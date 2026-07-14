import { FIXTURE_NAMES } from '../game/fixtures';
import type { DevOptions } from './devState';
import { devOptionsToSearch } from './devState';
import './devpanel.css';

/**
 * Hidden development panel, shown only with `?dev=1`. Every control is a
 * plain link that reloads the app with the corresponding query parameters,
 * so the resulting state is always reproducible from the URL alone.
 */
export function DevPanel({ current }: { current: DevOptions }) {
  return (
    <aside className="dev-panel" aria-label="Development state panel">
      <h2>dev states</h2>
      <ul>
        {FIXTURE_NAMES.map((name) => (
          <li key={name}>
            <a
              href={devOptionsToSearch({ ...current, fixture: name }) || '?'}
              aria-current={current.fixture === name ? 'true' : undefined}
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
      <h2>toggles</h2>
      <ul>
        <li>
          <a
            href={
              devOptionsToSearch({ ...current, debugTouchTargets: !current.debugTouchTargets }) ||
              '?'
            }
            aria-current={current.debugTouchTargets ? 'true' : undefined}
          >
            touch targets
          </a>
        </li>
        <li>
          <a
            href={
              devOptionsToSearch({ ...current, forceReducedMotion: !current.forceReducedMotion }) ||
              '?'
            }
            aria-current={current.forceReducedMotion ? 'true' : undefined}
          >
            reduced motion
          </a>
        </li>
        <li>
          <a
            href={
              devOptionsToSearch({ ...current, simulateInsets: !current.simulateInsets }) || '?'
            }
            aria-current={current.simulateInsets ? 'true' : undefined}
          >
            simulated insets
          </a>
        </li>
      </ul>
    </aside>
  );
}
