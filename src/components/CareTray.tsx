import type { RefObject } from 'react';
import type { TrayCategory } from '../game/types';
import { TRAY_CATEGORIES } from '../game/types';
import './tray.css';

const LABELS: Record<TrayCategory, string> = {
  feed: 'Feed',
  care: 'Care',
  play: 'Play',
  room: 'Room',
};

interface CareTrayProps {
  active: TrayCategory | null;
  onSelect: (category: TrayCategory) => void;
  /** The Feed button, so the app can hand focus back when a snack goes away. */
  feedRef?: RefObject<HTMLButtonElement | null>;
}

/** Bottom interaction dock: four future care categories as tactile buttons. */
export function CareTray({ active, onSelect, feedRef }: CareTrayProps) {
  return (
    <nav className="care-tray" aria-label="Care actions" data-active={active ?? undefined}>
      {TRAY_CATEGORIES.map((category) => (
        <button
          key={category}
          ref={category === 'feed' ? feedRef : undefined}
          type="button"
          className="tray-button"
          aria-pressed={active === category}
          onClick={() => onSelect(category)}
        >
          <span className="tray-icon" aria-hidden="true">
            <TrayIcon category={category} />
          </span>
          <span className="tray-label">{LABELS[category]}</span>
        </button>
      ))}
    </nav>
  );
}

function TrayIcon({ category }: { category: TrayCategory }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (category) {
    case 'feed':
      // food bowl with rising steam
      return (
        <svg {...common}>
          <path d="M4 12.5 h16 a8 7 0 0 1 -16 0 Z" />
          <path d="M7 12.5 h10" opacity="0.55" />
          <path d="M9.5 8.5 q1.4 -2 0 -4 M14.5 8.5 q1.4 -2 0 -4" />
        </svg>
      );
    case 'care':
      // heart cradled by an open hand
      return (
        <svg {...common}>
          <path d="M12 13.8 c-2.6 -2 -4.4 -3.6 -4.4 -5.5 a2.6 2.6 0 0 1 4.4 -1.9 a2.6 2.6 0 0 1 4.4 1.9 c0 1.9 -1.8 3.5 -4.4 5.5 Z" />
          <path d="M5 17.5 q7 3.4 14 0" />
        </svg>
      );
    case 'play':
      // bouncing ball with motion seam
      return (
        <svg {...common}>
          <circle cx="12" cy="11" r="6.5" />
          <path d="M6.6 8 q5.4 3 10.8 0 M6.6 14 q5.4 -3 10.8 0" opacity="0.55" />
          <path d="M7 20.5 h10" />
        </svg>
      );
    case 'room':
      // little lamp for the den
      return (
        <svg {...common}>
          <path d="M8.5 4 h7 l2 6 h-11 Z" />
          <path d="M12 10 v7" />
          <path d="M8 21 h8 M12 17.5 q0 2 -2 3.5" opacity="0.9" />
        </svg>
      );
  }
}
