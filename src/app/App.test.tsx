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

describe('screenshot-ready signal', () => {
  it('marks the document ready after the first painted frame', async () => {
    renderAt('');
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(document.documentElement.dataset.appReady).toBe('true');
  });
});
