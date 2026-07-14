import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Habitat } from '../components/Habitat';
import { CareTray } from '../components/CareTray';
import { Snack } from '../components/Snack';
import { Toast } from '../components/Toast';
import { JournalButton } from '../components/JournalButton';
import { DevPanel } from '../dev/DevPanel';
import { parseDevOptions } from '../dev/devState';
import { FIXTURES } from '../game/fixtures';
import {
  cancelDrag,
  describeSprig,
  endFeed,
  finishEating,
  grabSnack,
  moveSnack,
  releaseSnack,
  settleSnack,
  startFeed,
} from '../game/feed';
import type { HabitatState, TrayCategory } from '../game/types';
import './app.css';

const TRAY_MESSAGES: Record<Exclude<TrayCategory, 'feed'>, string> = {
  care: 'Grooming and comfort come later — Sprig leans in hopefully.',
  play: 'Toys are on their way — the little leaf perks up.',
  room: 'Room decorating opens later — Sprig surveys the den.',
};

// Live feeding timings (ms). Timers only ever start from user events, never
// from rendering a state — that is what keeps fixture-initialized phases
// (feed-hover, feed-returning, …) frozen for deterministic screenshots.
const FLIGHT_MS = 340; // tap/keyboard give: the snack's glide to Sprig
const EAT_MS = 1100; // munching
const LINGER_MS = 1500; // satisfied pause before Feed mode ends
const RETURN_MS = 460; // missed drop rolling back to rest

export function App() {
  const dev = useMemo(() => parseDevOptions(window.location.search), []);
  const [habitat, setHabitat] = useState<HabitatState>(() => FIXTURES[dev.fixture]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Event handlers (including window-level ones inside Snack) must always see
  // the latest habitat, so mirror it in a ref.
  const habitatRef = useRef(habitat);
  habitatRef.current = habitat;

  const feedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const creatureAnchorRef = useRef<HTMLDivElement | null>(null);
  const snackRef = useRef<HTMLButtonElement | null>(null);
  const feedButtonRef = useRef<HTMLButtonElement | null>(null);

  const clearFeedTimers = useCallback(() => {
    for (const t of feedTimers.current) clearTimeout(t);
    feedTimers.current = [];
  }, []);
  useEffect(() => clearFeedTimers, [clearFeedTimers]);

  const scheduleFeed = useCallback((delay: number, fn: () => void) => {
    feedTimers.current.push(setTimeout(fn, delay));
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /** If focus is on the snack (about to disappear), move it to Feed. */
  const rescueFocusFromSnack = useCallback(() => {
    if (document.activeElement === snackRef.current) {
      requestAnimationFrame(() => feedButtonRef.current?.focus());
    }
  }, []);

  /** eating → eaten → feed mode over. Started only from a successful give. */
  const runEatingSequence = useCallback(() => {
    showToast('Sprig eats the snack and looks happy.');
    scheduleFeed(EAT_MS, () => setHabitat(finishEating));
    scheduleFeed(EAT_MS + LINGER_MS, () => setHabitat(endFeed));
  }, [scheduleFeed, showToast]);

  const handleTraySelect = useCallback(
    (category: TrayCategory) => {
      const current = habitatRef.current;
      clearFeedTimers();
      if (category === 'feed') {
        if (current.activeTray === 'feed') {
          rescueFocusFromSnack();
          setHabitat(endFeed(current));
          showToast('The snack is put away.');
        } else {
          setHabitat(startFeed(current));
          showToast('A snack is ready for Sprig.');
          // The snack is the interaction; hand it focus so keyboard and
          // screen-reader users land on it directly.
          requestAnimationFrame(() => snackRef.current?.focus());
        }
        return;
      }
      rescueFocusFromSnack();
      const base = endFeed(current);
      setHabitat({ ...base, activeTray: base.activeTray === category ? null : category });
      showToast(TRAY_MESSAGES[category]);
    },
    [clearFeedTimers, rescueFocusFromSnack, showToast],
  );

  // ---- Snack gesture wiring ------------------------------------------------

  const handleSnackGrab = useCallback(() => {
    setHabitat(grabSnack(habitatRef.current));
  }, []);

  const handleSnackNearChange = useCallback((near: boolean) => {
    setHabitat(moveSnack(habitatRef.current, near));
  }, []);

  const handleSnackRelease = useCallback(() => {
    const next = releaseSnack(habitatRef.current);
    if (next === habitatRef.current) return;
    setHabitat(next);
    if (next.snack === 'eating') {
      rescueFocusFromSnack();
      runEatingSequence();
    } else {
      showToast('The snack rolled back — try again.');
      scheduleFeed(RETURN_MS, () => setHabitat(settleSnack));
    }
  }, [rescueFocusFromSnack, runEatingSequence, scheduleFeed, showToast]);

  /** Tap or keyboard activation: the snack glides to Sprig by itself. */
  const handleSnackGive = useCallback(() => {
    const current = habitatRef.current;
    if (current.snack !== 'ready' && current.snack !== 'held') return;
    setHabitat({ ...current, snack: 'held-near' });
    scheduleFeed(FLIGHT_MS, () => {
      const next = releaseSnack(habitatRef.current);
      if (next === habitatRef.current) return;
      rescueFocusFromSnack();
      setHabitat(next);
      runEatingSequence();
    });
  }, [rescueFocusFromSnack, runEatingSequence, scheduleFeed]);

  const handleSnackCancelDrag = useCallback(() => {
    const next = cancelDrag(habitatRef.current);
    if (next === habitatRef.current) return;
    setHabitat(next);
    showToast('The snack rolled back — try again.');
    scheduleFeed(RETURN_MS, () => setHabitat(settleSnack));
  }, [scheduleFeed, showToast]);

  /** Escape on the resting snack: leave Feed mode, focus returns to Feed. */
  const handleSnackDismiss = useCallback(() => {
    clearFeedTimers();
    rescueFocusFromSnack();
    setHabitat(endFeed(habitatRef.current));
    showToast('The snack is put away.');
  }, [clearFeedTimers, rescueFocusFromSnack, showToast]);

  // The feeding area is Sprig's visible body, not the full anchor box (the
  // SVG viewBox has generous horizontal padding; using it raw would make the
  // snack's resting spot count as "near").
  const getCreatureRect = useCallback(() => {
    const rect = creatureAnchorRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return new DOMRect(
      rect.x + rect.width * 0.18,
      rect.y + rect.height * 0.14,
      rect.width * 0.64,
      rect.height * 0.86,
    );
  }, []);

  /** Live eye tracking while the snack is carried; null clears to defaults. */
  const handleSnackLook = useCallback((x: number | null, y: number | null) => {
    const anchor = creatureAnchorRef.current;
    if (!anchor) return;
    if (x == null || y == null) {
      anchor.style.removeProperty('--look-x');
      anchor.style.removeProperty('--look-y');
    } else {
      anchor.style.setProperty('--look-x', x.toFixed(3));
      anchor.style.setProperty('--look-y', y.toFixed(3));
    }
  }, []);

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

  const snackVisible =
    habitat.snack === 'ready' ||
    habitat.snack === 'held' ||
    habitat.snack === 'held-near' ||
    habitat.snack === 'returning';

  return (
    <div
      className="app-shell"
      data-time={habitat.timeOfDay}
      data-motion={dev.forceReducedMotion ? 'reduced' : 'full'}
      data-debug={dev.debugTouchTargets ? 'touch-targets' : undefined}
      data-sim-insets={dev.simulateInsets ? 'true' : undefined}
    >
      <main className="stage" aria-label="Sprig’s habitat">
        {/* Semantic stand-in for the aria-hidden creature artwork. */}
        <p className="sr-only">{describeSprig(habitat)}</p>
        <Habitat state={habitat} creatureAnchorRef={creatureAnchorRef} />
        {snackVisible && (
          <Snack
            phase={habitat.snack}
            onGrab={handleSnackGrab}
            onNearChange={handleSnackNearChange}
            onRelease={handleSnackRelease}
            onGive={handleSnackGive}
            onCancelDrag={handleSnackCancelDrag}
            onDismiss={handleSnackDismiss}
            getTargetRect={getCreatureRect}
            onLook={handleSnackLook}
            buttonRef={snackRef}
          />
        )}
        <JournalButton onActivate={handleJournal} />
        <Toast message={toast} />
        <CareTray active={habitat.activeTray} onSelect={handleTraySelect} feedRef={feedButtonRef} />
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
