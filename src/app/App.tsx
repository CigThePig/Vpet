import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Habitat } from '../components/Habitat';
import { CareTray } from '../components/CareTray';
import { Toast } from '../components/Toast';
import { JournalButton } from '../components/JournalButton';
import { DevPanel } from '../dev/DevPanel';
import { parseDevOptions } from '../dev/devState';
import { FIXTURES } from '../game/fixtures';
import type { HabitatState, TrayCategory } from '../game/types';
import './app.css';

const TRAY_MESSAGES: Record<TrayCategory, string> = {
  feed: 'Snacks arrive in a future update — Sprig sniffs around anyway.',
  care: 'Grooming and comfort come later — Sprig leans in hopefully.',
  play: 'Toys are on their way — the little leaf perks up.',
  room: 'Room decorating opens later — Sprig surveys the den.',
};

export function App() {
  const dev = useMemo(() => parseDevOptions(window.location.search), []);
  const [habitat, setHabitat] = useState<HabitatState>(() => FIXTURES[dev.fixture]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleTraySelect = useCallback(
    (category: TrayCategory) => {
      setHabitat((prev) => ({
        ...prev,
        activeTray: prev.activeTray === category ? null : category,
      }));
      showToast(TRAY_MESSAGES[category]);
    },
    [showToast],
  );

  const handleJournal = useCallback(() => {
    showToast('The journal will live here — nothing to read yet.');
  }, [showToast]);

  // Screenshot-ready signal: set once the first frame has been committed and
  // painted. The visual harness waits for html[data-app-ready="true"].
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        document.documentElement.dataset.appReady = 'true';
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  return (
    <div
      className="app-shell"
      data-time={habitat.timeOfDay}
      data-motion={dev.forceReducedMotion ? 'reduced' : 'full'}
      data-debug={dev.debugTouchTargets ? 'touch-targets' : undefined}
      data-sim-insets={dev.simulateInsets ? 'true' : undefined}
    >
      <main className="stage" aria-label="Sprig’s habitat">
        <Habitat state={habitat} />
        <JournalButton onActivate={handleJournal} />
        <Toast message={toast} />
        <CareTray active={habitat.activeTray} onSelect={handleTraySelect} />
      </main>
      {dev.debugTouchTargets && (
        <div className="touch-target-legend">
          <span className="swatch" aria-hidden="true" />
          touch targets ≥ 44px
        </div>
      )}
      {dev.showDevPanel && <DevPanel current={dev} />}
    </div>
  );
}
