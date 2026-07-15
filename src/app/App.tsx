import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Habitat } from '../components/Habitat';
import { CareTray } from '../components/CareTray';
import { Snack } from '../components/Snack';
import { PetZone } from '../components/PetZone';
import { Toast } from '../components/Toast';
import { JournalButton } from '../components/JournalButton';
import { DevPanel } from '../dev/DevPanel';
import { parseDevOptions } from '../dev/devState';
import { FIXTURES } from '../game/fixtures';
import {
  describeSprig,
  dropSnack,
  endFeed,
  finishEating,
  grabSnack,
  landSnack,
  moveSnack,
  perchSnack,
  releaseSnack,
  setFlourish,
  shakeOffSnack,
  startFeed,
} from '../game/feed';
import { beginStroke, blissOut, endPetting, restHand, startPetting } from '../game/pet';
import type { HabitatState, TrayCategory } from '../game/types';
import './app.css';

const TRAY_MESSAGES: Record<Exclude<TrayCategory, 'feed' | 'care'>, string> = {
  play: 'Toys are on their way — the little leaf perks up.',
  room: 'Room decorating opens later — Sprig surveys the den.',
};

// Live interaction timings (ms). Timers only ever start from user events,
// never from rendering a state — that is what keeps fixture-initialized
// phases (feed-hover, pet-stroking, …) frozen for deterministic screenshots.
const FLIGHT_MS = 340; // tap/keyboard give: the snack's glide to Sprig
const EAT_MS = 1100; // munching
const GOBBLE_MS = 1300; // bowing down + eating off the floor
const LINGER_MS = 1500; // satisfied pause before Feed mode ends
const PERCH_MS = 2600; // how long a head-perched berry balances before the shake-off
const TEASE_MS = 1600; // how long the cheek-puff pout lasts
const YEARN_DELAY_MS = 3500; // resting berry → first hopeful reach
const YEARN_HOLD_MS = 1200; // how long each reach lasts
const YEARN_GAP_MS = 5000; // pause between reaches
const PAT_MS = 750; // a pat (tap/keyboard) is savoured briefly before bliss
const BLISS_MS = 2000; // blissful linger before Care mode ends

export function App() {
  const dev = useMemo(() => parseDevOptions(window.location.search), []);
  const [habitat, setHabitat] = useState<HabitatState>(() => FIXTURES[dev.fixture]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Event handlers (including window-level ones inside Snack) must always see
  // the latest habitat, so mirror it in a ref.
  const habitatRef = useRef(habitat);
  habitatRef.current = habitat;

  // One shared pool for all interaction timers (feeding and petting): a tray
  // change clears everything, so modes can never leak timers into each other.
  const interactionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const yearnTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const creatureAnchorRef = useRef<HTMLDivElement | null>(null);
  const snackRef = useRef<HTMLButtonElement | null>(null);
  const petZoneRef = useRef<HTMLButtonElement | null>(null);
  const feedButtonRef = useRef<HTMLButtonElement | null>(null);
  const careButtonRef = useRef<HTMLButtonElement | null>(null);

  const reducedMotion = useMemo(
    () =>
      dev.forceReducedMotion ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    [dev.forceReducedMotion],
  );

  const clearYearnTimers = useCallback(() => {
    for (const t of yearnTimers.current) clearTimeout(t);
    yearnTimers.current = [];
  }, []);

  const clearInteractionTimers = useCallback(() => {
    for (const t of interactionTimers.current) clearTimeout(t);
    interactionTimers.current = [];
    clearYearnTimers();
  }, [clearYearnTimers]);
  useEffect(() => clearInteractionTimers, [clearInteractionTimers]);

  const scheduleInteraction = useCallback((delay: number, fn: () => void) => {
    interactionTimers.current.push(setTimeout(fn, delay));
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

  /** If focus is on the pet zone (about to disappear), move it to Care. */
  const rescueFocusFromPetZone = useCallback(() => {
    if (document.activeElement === petZoneRef.current) {
      requestAnimationFrame(() => careButtonRef.current?.focus());
    }
  }, []);

  /**
   * While the berry rests on the floor, Sprig occasionally reaches for it.
   * Live-only: the loop starts from user-driven events (activation, landing)
   * and dies silently the moment the berry is no longer resting.
   */
  const startYearnLoop = useCallback(() => {
    clearYearnTimers();
    const reach = () => {
      if (habitatRef.current.snack !== 'ready') return; // loop ends
      setHabitat((s) => setFlourish(s, 'yearning'));
      yearnTimers.current.push(
        setTimeout(() => {
          setHabitat((s) => (s.flourish === 'yearning' ? setFlourish(s, 'none') : s));
          yearnTimers.current.push(setTimeout(reach, YEARN_GAP_MS));
        }, YEARN_HOLD_MS),
      );
    };
    yearnTimers.current.push(setTimeout(reach, YEARN_DELAY_MS));
  }, [clearYearnTimers]);

  /** eating/gobbling → eaten → feed mode over. Started only from live events. */
  const runEatingSequence = useCallback(
    (munchMs: number) => {
      showToast('Sprig eats the snack and looks happy.');
      scheduleInteraction(munchMs, () => setHabitat(finishEating));
      scheduleInteraction(munchMs + LINGER_MS, () => setHabitat(endFeed));
    },
    [scheduleInteraction, showToast],
  );

  const handleTraySelect = useCallback(
    (category: TrayCategory) => {
      const current = habitatRef.current;
      clearInteractionTimers();
      if (category === 'feed') {
        if (current.activeTray === 'feed') {
          rescueFocusFromSnack();
          setHabitat(endFeed(current));
          showToast('The snack is put away.');
        } else {
          rescueFocusFromPetZone();
          setHabitat(startFeed(endPetting(current)));
          showToast('A snack is ready for Sprig.');
          startYearnLoop();
          // The snack is the interaction; hand it focus so keyboard and
          // screen-reader users land on it directly.
          requestAnimationFrame(() => snackRef.current?.focus());
        }
        return;
      }
      if (category === 'care') {
        if (current.activeTray === 'care') {
          rescueFocusFromPetZone();
          setHabitat(endPetting(current));
          showToast('Sprig settles back down.');
        } else {
          rescueFocusFromSnack();
          setHabitat(startPetting(endFeed(current)));
          showToast('Sprig leans in, hoping to be petted.');
          // Sprig is the interaction; hand focus to the pettable area so
          // keyboard and screen-reader users land on it directly.
          requestAnimationFrame(() => petZoneRef.current?.focus());
        }
        return;
      }
      rescueFocusFromSnack();
      rescueFocusFromPetZone();
      const base = endPetting(endFeed(current));
      setHabitat({ ...base, activeTray: base.activeTray === category ? null : category });
      showToast(TRAY_MESSAGES[category]);
    },
    [
      clearInteractionTimers,
      rescueFocusFromPetZone,
      rescueFocusFromSnack,
      showToast,
      startYearnLoop,
    ],
  );

  // ---- Snack gesture wiring ------------------------------------------------

  const handleSnackGrab = useCallback(() => {
    clearYearnTimers();
    setHabitat(grabSnack(habitatRef.current));
  }, [clearYearnTimers]);

  const handleSnackNearChange = useCallback((near: boolean) => {
    setHabitat(moveSnack(habitatRef.current, near));
  }, []);

  /** Released over the mouth: the one true feeding path. */
  const handleSnackFeed = useCallback(() => {
    const next = releaseSnack(habitatRef.current);
    if (next === habitatRef.current || next.snack !== 'eating') return;
    rescueFocusFromSnack();
    setHabitat(next);
    runEatingSequence(EAT_MS);
  }, [rescueFocusFromSnack, runEatingSequence]);

  /** Released over the head: the berry balances until Sprig shakes it off. */
  const handleSnackPerched = useCallback(() => {
    const next = perchSnack(habitatRef.current);
    if (next === habitatRef.current) return;
    setHabitat(next);
    showToast('The berry balances on Sprig’s head.');
    scheduleInteraction(PERCH_MS, () => setHabitat(shakeOffSnack));
  }, [scheduleInteraction, showToast]);

  /** Released anywhere else: the berry drops and tumbles (physics in Snack). */
  const handleSnackDropped = useCallback(() => {
    const next = dropSnack(habitatRef.current);
    if (next === habitatRef.current) return;
    setHabitat(next);
    showToast('The snack tumbles across the floor.');
  }, [showToast]);

  /** The tumble ended. In front of Sprig's feet → gobbled off the floor. */
  const handleSnackLanded = useCallback(
    (inFeedZone: boolean) => {
      const next = landSnack(habitatRef.current, inFeedZone);
      if (next === habitatRef.current) return;
      setHabitat(next);
      if (next.snack === 'gobbling') {
        rescueFocusFromSnack();
        runEatingSequence(GOBBLE_MS);
      } else {
        startYearnLoop();
      }
    },
    [rescueFocusFromSnack, runEatingSequence, startYearnLoop],
  );

  /** The berry was waggled in Sprig's face: brief indignant pout. */
  const handleSnackTease = useCallback(() => {
    const next = setFlourish(habitatRef.current, 'teased');
    if (next === habitatRef.current) return;
    setHabitat(next);
    scheduleInteraction(TEASE_MS, () =>
      setHabitat((s) => (s.flourish === 'teased' ? setFlourish(s, 'none') : s)),
    );
  }, [scheduleInteraction]);

  /** Tap or keyboard activation: the snack glides to Sprig by itself. */
  const handleSnackGive = useCallback(() => {
    const current = habitatRef.current;
    if (current.snack !== 'ready' && current.snack !== 'held' && current.snack !== 'perched')
      return;
    clearYearnTimers();
    setHabitat({ ...current, snack: 'held-near', flourish: 'none' });
    scheduleInteraction(FLIGHT_MS, () => {
      const next = releaseSnack(habitatRef.current);
      if (next === habitatRef.current) return;
      rescueFocusFromSnack();
      setHabitat(next);
      runEatingSequence(EAT_MS);
    });
  }, [clearYearnTimers, rescueFocusFromSnack, runEatingSequence, scheduleInteraction]);

  /** Escape on the resting snack: leave Feed mode, focus returns to Feed. */
  const handleSnackDismiss = useCallback(() => {
    clearInteractionTimers();
    rescueFocusFromSnack();
    setHabitat(endFeed(habitatRef.current));
    showToast('The snack is put away.');
  }, [clearInteractionTimers, rescueFocusFromSnack, showToast]);

  // ---- Petting gesture wiring ------------------------------------------------

  /** bliss → care mode over. Started only from live events. */
  const runBlissSequence = useCallback(() => {
    const next = blissOut(habitatRef.current);
    if (next === habitatRef.current) return;
    rescueFocusFromPetZone();
    setHabitat(next);
    showToast('Sprig melts into the petting.');
    scheduleInteraction(BLISS_MS, () => setHabitat(endPetting));
  }, [rescueFocusFromPetZone, scheduleInteraction, showToast]);

  const handlePetBegin = useCallback(() => {
    setHabitat(beginStroke(habitatRef.current));
  }, []);

  const handlePetRest = useCallback(() => {
    setHabitat(restHand(habitatRef.current));
  }, []);

  /** Sprig leans toward the stroking hand; null clears to the pose default. */
  const handlePetStroke = useCallback((x: number | null) => {
    const anchor = creatureAnchorRef.current;
    if (!anchor) return;
    if (x == null) {
      anchor.style.removeProperty('--pet-x');
    } else {
      anchor.style.setProperty('--pet-x', x.toFixed(3));
    }
  }, []);

  /** Tap or keyboard activation: a single pat, savoured, then bliss. */
  const handlePetPat = useCallback(() => {
    const current = habitatRef.current;
    if (current.petting !== 'ready' && current.petting !== 'stroking') return;
    setHabitat(beginStroke(current));
    scheduleInteraction(PAT_MS, runBlissSequence);
  }, [runBlissSequence, scheduleInteraction]);

  /** Escape on the pettable area: leave Care mode, focus returns to Care. */
  const handlePetDismiss = useCallback(() => {
    clearInteractionTimers();
    rescueFocusFromPetZone();
    setHabitat(endPetting(habitatRef.current));
    showToast('Sprig settles back down.');
  }, [clearInteractionTimers, rescueFocusFromPetZone, showToast]);

  // Clear any lingering lean once nothing is being stroked.
  useEffect(() => {
    if (habitat.petting !== 'stroking') {
      creatureAnchorRef.current?.style.removeProperty('--pet-x');
    }
  }, [habitat.petting]);

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

  /** Live eye tracking while the snack moves; null clears to pose defaults. */
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

  // Clear any lingering live gaze once the snack is gone.
  useEffect(() => {
    if (habitat.snack === 'none' || habitat.snack === 'eaten') {
      handleSnackLook(null, null);
    }
  }, [habitat.snack, handleSnackLook]);

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
    habitat.snack !== 'none' && habitat.snack !== 'eating' && habitat.snack !== 'eaten';
  // Blissed-out Sprig is done being petted: the zone leaves with the phase.
  const petZoneVisible = habitat.petting === 'ready' || habitat.petting === 'stroking';

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
            reducedMotion={reducedMotion}
            onGrab={handleSnackGrab}
            onNearChange={handleSnackNearChange}
            onFeed={handleSnackFeed}
            onPerched={handleSnackPerched}
            onDropped={handleSnackDropped}
            onLanded={handleSnackLanded}
            onTease={handleSnackTease}
            onGive={handleSnackGive}
            onDismiss={handleSnackDismiss}
            getTargetRect={getCreatureRect}
            onLook={handleSnackLook}
            buttonRef={snackRef}
          />
        )}
        {petZoneVisible && (
          <PetZone
            phase={habitat.petting}
            onBegin={handlePetBegin}
            onStroke={handlePetStroke}
            onRest={handlePetRest}
            onBliss={runBlissSequence}
            onPat={handlePetPat}
            onDismiss={handlePetDismiss}
            buttonRef={petZoneRef}
          />
        )}
        <JournalButton onActivate={handleJournal} />
        <Toast message={toast} />
        <CareTray
          active={habitat.activeTray}
          onSelect={handleTraySelect}
          feedRef={feedButtonRef}
          careRef={careButtonRef}
        />
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
