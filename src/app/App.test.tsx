import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function renderAt(search: string) {
  window.history.replaceState(null, '', `/${search}`);
  return render(<App />);
}

beforeEach(() => {
  delete document.documentElement.dataset.appReady;
});

describe('App startup', () => {
  it('renders the habitat with the main controls', () => {
    renderAt('');
    expect(screen.getByRole('main', { name: /habitat/i })).toBeInTheDocument();
    for (const name of ['Feed', 'Care', 'Play', 'Room']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /journal and settings/i })).toBeInTheDocument();
  });

  it('does not render dev tooling on a plain URL', () => {
    renderAt('');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('state selection via query parameters', () => {
  it('starts in day/idle by default', () => {
    const { container } = renderAt('');
    const shell = container.querySelector('.app-shell')!;
    expect(shell).toHaveAttribute('data-time', 'day');
    expect(shell).toHaveAttribute('data-motion', 'full');
  });

  it('?state=night renders the night habitat', () => {
    const { container } = renderAt('?state=night');
    expect(container.querySelector('.app-shell')).toHaveAttribute('data-time', 'night');
  });

  it('?state=care-tray pre-activates the feed button', () => {
    renderAt('?state=care-tray');
    expect(screen.getByRole('button', { name: 'Feed' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('?motion=reduced sets the reduced-motion attribute', () => {
    const { container } = renderAt('?motion=reduced');
    expect(container.querySelector('.app-shell')).toHaveAttribute('data-motion', 'reduced');
  });

  it('?dev=1 shows the dev panel', () => {
    renderAt('?dev=1');
    expect(screen.getByRole('complementary', { name: /development/i })).toBeInTheDocument();
  });
});

describe('care tray interaction', () => {
  it('toggles a category and shows a development message', () => {
    vi.useFakeTimers();
    try {
      renderAt('');
      const feed = screen.getByRole('button', { name: 'Feed' });

      fireEvent.click(feed);
      expect(feed).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('status')).toHaveTextContent(/snack/i);

      // The message dismisses itself.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByRole('status')).toHaveAttribute('data-visible', 'false');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('feeding interaction', () => {
  it('activating Feed makes exactly one snack available and announces it', () => {
    renderAt('');
    fireEvent.click(screen.getByRole('button', { name: 'Feed' }));
    expect(screen.getAllByRole('button', { name: /give snack to sprig/i })).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(/snack is ready/i);
  });

  it('toggling Feed off puts the snack away', () => {
    renderAt('');
    const feed = screen.getByRole('button', { name: 'Feed' });
    fireEvent.click(feed);
    fireEvent.click(feed);
    expect(screen.queryByRole('button', { name: /give snack/i })).not.toBeInTheDocument();
  });

  it('keyboard activation feeds Sprig exactly once and ends feed mode', () => {
    vi.useFakeTimers();
    try {
      renderAt('?state=feed-ready');
      const snack = screen.getByRole('button', { name: /give snack/i });
      fireEvent.click(snack);
      fireEvent.click(snack); // a second activation mid-flight must be ignored
      act(() => {
        vi.advanceTimersByTime(400); // flight completes → eating
      });
      expect(screen.queryByRole('button', { name: /give snack/i })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/eats the snack/i);
      act(() => {
        vi.advanceTimersByTime(3000); // munch + satisfied linger → feed over
      });
      expect(screen.getByRole('button', { name: 'Feed' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('button', { name: /give snack/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('switching to another category removes the snack', () => {
    renderAt('?state=feed-ready');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.queryByRole('button', { name: /give snack/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('feed fixtures resolve to their presentation states', () => {
    const { container, unmount } = renderAt('?state=feed-hover');
    expect(container.querySelector('.creature')).toHaveAttribute('data-reaction', 'anticipate');
    unmount();
    const eaten = renderAt('?state=feed-eaten');
    expect(eaten.container.querySelector('.creature')).toHaveAttribute(
      'data-reaction',
      'satisfied',
    );
    expect(screen.queryByRole('button', { name: /give snack/i })).not.toBeInTheDocument();
  });

  it('exposes a concise accessible description of Sprig', () => {
    const { unmount } = renderAt('?state=feed-ready');
    expect(screen.getByText(/sprig notices the snack/i)).toBeInTheDocument();
    unmount();
    renderAt('');
    expect(screen.getByText(/sprig is calm/i)).toBeInTheDocument();
  });
});

describe('screenshot-ready signal', () => {
  it('marks the document ready after the first painted frame', async () => {
    renderAt('');
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(document.documentElement.dataset.appReady).toBe('true');
  });
});
