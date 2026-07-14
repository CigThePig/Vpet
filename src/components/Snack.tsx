import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { SnackPhase } from '../game/types';
import './snack.css';

interface SnackProps {
  /** Current lifecycle phase (phases without a berry on screen don't render). */
  phase: SnackPhase;
  /** True when motion should be minimal: physics resolves instantly. */
  reducedMotion: boolean;
  /** The player picked the snack up with a pointer. */
  onGrab: () => void;
  /** The carried snack entered/left Sprig's feeding area. */
  onNearChange: (near: boolean) => void;
  /** Released over Sprig's mouth: feed. */
  onFeed: () => void;
  /** Released over Sprig's head: the berry balances there. */
  onPerched: () => void;
  /** Released anywhere else (or drag interrupted): the berry drops. */
  onDropped: () => void;
  /** The dropped berry stopped rolling; true if in front of Sprig's feet. */
  onLanded: (inFeedZone: boolean) => void;
  /** The berry was waggled in Sprig's face. */
  onTease: () => void;
  /** Tap or keyboard activation: give the snack directly (auto-flight). */
  onGive: () => void;
  /** Escape while resting: put the snack away. */
  onDismiss: () => void;
  /** Sprig's on-screen body box, for zone detection. */
  getTargetRect: () => DOMRect | null;
  /** Eye-tracking vector (−1..1), or null to clear back to defaults. */
  onLook: (x: number | null, y: number | null) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

/** Movement below this (px) counts as a tap, which gives the snack directly. */
const TAP_SLOP = 8;
/** The feeding area: Sprig's body box grown by this margin (px). */
const TARGET_MARGIN = 14;
/** Berry radius (px) for rolling rotation. */
const BERRY_RADIUS = 17;

// Physics constants, in px per 60fps frame.
const GRAVITY = 1.05;
const BOUNCE = 0.45; // restitution off the floor
const BOUNCE_DRAG = 0.72; // horizontal energy lost on impact
const ROLL_FRICTION = 0.955;
const SETTLE_SPEED = 0.18;
const MAX_VX = 15;
const MAX_UP = 14;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  /** Snack centre at grab time (viewport px). */
  baseCx: number;
  baseCy: number;
  /** Furthest distance travelled, to distinguish taps from drags. */
  moved: number;
  near: boolean;
  /** Recent pointer samples for release velocity. */
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
  /** Tease detection: horizontal direction flips near Sprig's face. */
  teaseDir: 0 | 1 | -1;
  teaseFlips: number;
  teaseAccum: number;
  teaseWindowStart: number;
}

interface Flight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  /** Ground level for this tumble (≥ 0 when dropped below the floor plane). */
  floorY: number;
  /** Viewport position of the berry's layout home (transform excluded). */
  homeX: number;
  homeY: number;
}

/**
 * The one draggable snack: a small berry that behaves like a physical thing.
 *
 * Pointer Events with pointer capture drive the drag; position updates go
 * straight to the DOM (style.transform) — React state changes only on
 * lifecycle transitions, never per move. Releasing the berry anywhere but
 * Sprig's mouth DROPS it: a small rAF physics loop (gravity, bounce with
 * squash + dust, roll with spin) carries it to a new resting spot on the
 * floor plane, where it stays and can be picked up again. Release over the
 * head perches it; a waggle near the face registers as teasing. A press that
 * never travels (tap, VoiceOver double-tap, keyboard Enter/Space) still
 * gives the snack directly with an automatic glide to Sprig's mouth.
 */
export function Snack({
  phase,
  reducedMotion,
  onGrab,
  onNearChange,
  onFeed,
  onPerched,
  onDropped,
  onLanded,
  onTease,
  onGive,
  onDismiss,
  getTargetRect,
  onLook,
  buttonRef,
}: SnackProps) {
  const gestureRef = useRef<Gesture | null>(null);
  /** Persistent offset of the berry's current home from its CSS layout spot. */
  const baseRef = useRef({ x: 0, y: 0 });
  /** True once a live gesture/physics has moved the berry off its CSS spot. */
  const liveRef = useRef(false);
  const flightRef = useRef<Flight | null>(null);
  const rafRef = useRef(0);
  const glideRef = useRef(false);
  const suppressClickRef = useRef(false);
  // Keep callbacks fresh for window-level listeners and the rAF loop.
  const cbRef = useRef({ onDropped, onLanded, onLook, getTargetRect });
  cbRef.current = { onDropped, onLanded, onLook, getTargetRect };
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  /** The offset currently painted via style.transform (home-relative px). */
  const posRef = useRef({ x: 0, y: 0 });

  const setTransform = (x: number, y: number, angle = 0) => {
    const el = buttonRef.current;
    if (!el) return;
    posRef.current = { x, y };
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const spin = el.querySelector<HTMLElement>('.snack-spin');
    if (spin) spin.style.transform = angle === 0 ? '' : `rotate(${angle}deg)`;
  };

  /** Viewport centre of the berry's layout spot (transform stripped). */
  const homePoint = () => {
    const el = buttonRef.current!;
    const rect = el.getBoundingClientRect();
    const p = posRef.current;
    return { x: rect.left + rect.width / 2 - p.x, y: rect.top + rect.height / 2 - p.y };
  };

  const gesturePoint = () => {
    const g = gestureRef.current;
    if (!g) return null;
    return { x: baseRef.current.x + g.lastX - g.startX, y: baseRef.current.y + g.lastY - g.startY };
  };

  // ---- Physics ---------------------------------------------------------------

  const spawnDust = (cx: number, cy: number, strength: number) => {
    if (reducedRef.current) return;
    const dust = document.createElement('span');
    dust.className = 'snack-dust';
    dust.setAttribute('aria-hidden', 'true');
    dust.style.left = `${cx}px`;
    dust.style.top = `${cy}px`;
    dust.style.setProperty('--dust-scale', String(Math.min(1.4, 0.7 + strength * 0.09)));
    document.body.appendChild(dust);
    setTimeout(() => dust.remove(), 520);
  };

  const squash = (strength: number) => {
    if (reducedRef.current) return;
    const body = buttonRef.current?.querySelector('.snack-body');
    const s = Math.min(0.4, 0.14 + strength * 0.03);
    body?.animate([{ transform: `scale(${1 + s}, ${1 - s})` }, { transform: 'scale(1, 1)' }], {
      duration: 240,
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    });
  };

  const stopFlight = () => {
    cancelAnimationFrame(rafRef.current);
    flightRef.current = null;
  };

  /** Where the berry may travel horizontally, in viewport px. */
  const wallsFor = () => {
    const stage = buttonRef.current?.closest('.stage');
    const rect = stage?.getBoundingClientRect();
    return rect
      ? { left: rect.left + 10 + 28, right: rect.right - 10 - 28 }
      : { left: 38, right: window.innerWidth - 38 };
  };

  const settleFlight = (f: Flight) => {
    stopFlight();
    baseRef.current = { x: f.x, y: f.floorY };
    setTransform(f.x, f.floorY, 0);
    const target = cbRef.current.getTargetRect();
    const cx = f.homeX + f.x;
    let inFeedZone = false;
    if (target) {
      inFeedZone = cx >= target.left + 4 && cx <= target.right - 4;
      // Leave Sprig glancing at wherever the berry actually stopped.
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      cbRef.current.onLook(
        clamp((cx - (target.left + target.width / 2)) / 160),
        clamp((f.homeY - (target.top + target.height / 2)) / 160),
      );
    }
    cbRef.current.onLanded(inFeedZone);
  };

  /** Drop the berry from `start` (home-relative px) with initial velocity. */
  const launch = (start: { x: number; y: number }, vx: number, vy: number) => {
    const home = homePoint();
    const f: Flight = {
      x: start.x,
      y: start.y,
      vx: Math.max(-MAX_VX, Math.min(MAX_VX, vx)),
      vy: Math.max(-MAX_UP, Math.min(MAX_UP, vy)),
      angle: 0,
      // The floor plane runs through the berry's home spot; a berry let go
      // below it (near the tray) simply rests where it was dropped.
      floorY: Math.max(0, start.y),
      homeX: home.x,
      homeY: home.y,
    };

    if (reducedRef.current) {
      // Reduced motion: resolve the physics instantly, no animation frames.
      const walls = wallsFor();
      f.x = Math.max(walls.left - f.homeX, Math.min(walls.right - f.homeX, f.x + f.vx * 6));
      f.y = f.floorY;
      settleFlight(f);
      return;
    }

    flightRef.current = f;
    let last = performance.now();
    const step = (now: number) => {
      const cur = flightRef.current;
      if (cur !== f) return;
      const dt = Math.min(2.5, (now - last) / 16.67);
      last = now;

      f.vy += GRAVITY * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      const walls = wallsFor();
      const cx = f.homeX + f.x;
      if (cx < walls.left || cx > walls.right) {
        f.x = (cx < walls.left ? walls.left : walls.right) - f.homeX;
        f.vx = -f.vx * 0.35;
      }

      let rolling = false;
      if (f.y >= f.floorY) {
        // Floor contact.
        f.y = f.floorY;
        if (f.vy > 1.4) {
          // A real bounce: squash, dust, lose energy.
          squash(f.vy);
          spawnDust(f.homeX + f.x, f.homeY + f.floorY + 28, f.vy);
          f.vy = -f.vy * BOUNCE;
          f.vx *= BOUNCE_DRAG;
        } else {
          // Rolling.
          f.vy = 0;
          f.vx *= Math.pow(ROLL_FRICTION, dt);
          rolling = true;
        }
      }
      f.angle += ((f.vx * dt) / BERRY_RADIUS) * (180 / Math.PI);
      setTransform(f.x, f.y, f.angle);

      // Sprig follows the tumbling berry with its eyes.
      const target = cbRef.current.getTargetRect();
      if (target) {
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        cbRef.current.onLook(
          clamp((f.homeX + f.x - (target.left + target.width / 2)) / 160),
          clamp((f.homeY + f.y - (target.top + target.height / 2)) / 160),
        );
      }

      // A berry rolling into Sprig is stopped by its feet — and gobbled.
      if (
        rolling &&
        target &&
        f.homeX + f.x >= target.left + 4 &&
        f.homeX + f.x <= target.right - 4
      ) {
        settleFlight(f);
        return;
      }

      if (rolling && Math.abs(f.vx) < SETTLE_SPEED) {
        settleFlight(f);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // Sprig shakes a perched berry off: the app flips the phase to 'falling'
  // without a pointer release, so give the tumble its default little hop.
  useEffect(() => {
    if (phase === 'falling' && !flightRef.current && !gestureRef.current) {
      liveRef.current = true;
      launch(baseRef.current, baseRef.current.x >= 0 ? -4.2 : 4.2, -7);
    }
    if (phase !== 'falling' && phase !== 'ready') stopFlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup on unmount: never leave a physics loop or dust behind.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // ---- Gesture ---------------------------------------------------------------

  /** Interrupt a live drag (Escape, pointer cancel, blur): drop the berry. */
  const abortDrag = () => {
    const el = buttonRef.current;
    const g = gestureRef.current;
    if (!el || !g) return;
    const p = gesturePoint()!;
    gestureRef.current = null;
    if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);
    cbRef.current.onDropped();
    launch(p, g.vx * 0.4, Math.max(0, g.vy * 0.4));
  };
  const abortRef = useRef(abortDrag);
  abortRef.current = abortDrag;

  // Window-level interruption handling, active only while dragging.
  useEffect(() => {
    if (phase !== 'held' && phase !== 'held-near') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') abortRef.current();
    };
    const onBlur = () => abortRef.current();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [phase]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || gestureRef.current) return;
    if (phase !== 'ready' && phase !== 'perched' && phase !== 'falling') return;
    // Catching a tumbling berry: freeze the physics where it is and pick up.
    if (phase === 'falling') {
      baseRef.current = { ...posRef.current };
    }
    stopFlight();
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    el.removeAttribute('data-glide');
    const rect = el.getBoundingClientRect();
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseCx: rect.left + rect.width / 2,
      baseCy: rect.top + rect.height / 2,
      moved: 0,
      near: false,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      vx: 0,
      vy: 0,
      teaseDir: 0,
      teaseFlips: 0,
      teaseAccum: 0,
      teaseWindowStart: event.timeStamp,
    };
    liveRef.current = true;
    onGrab();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    g.moved = Math.max(g.moved, Math.hypot(dx, dy));
    setTransform(baseRef.current.x + dx, baseRef.current.y + dy);

    // Release velocity, in px per 60fps frame, lightly smoothed.
    const dt = Math.max(1, event.timeStamp - g.lastT);
    const stepX = event.clientX - g.lastX;
    const stepY = event.clientY - g.lastY;
    g.vx = g.vx * 0.4 + (stepX / dt) * 16.67 * 0.6;
    g.vy = g.vy * 0.4 + (stepY / dt) * 16.67 * 0.6;
    g.lastT = event.timeStamp;

    // Target rect is re-read every move so orientation/viewport changes
    // mid-drag cannot leave a stale feeding area.
    const target = getTargetRect();
    if (!target) return;
    const cx = g.baseCx + dx;
    const cy = g.baseCy + dy;
    const near =
      cx >= target.left - TARGET_MARGIN &&
      cx <= target.right + TARGET_MARGIN &&
      cy >= target.top - TARGET_MARGIN &&
      cy <= target.bottom + TARGET_MARGIN;
    if (near !== g.near) {
      g.near = near;
      onNearChange(near);
    }
    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    onLook(clamp((cx - tx) / 160), clamp((cy - ty) / 160));

    // Teasing: quick left-right waggles close to Sprig's face.
    if (Math.hypot(cx - tx, cy - ty) < 240) {
      if (event.timeStamp - g.teaseWindowStart > 1200) {
        g.teaseWindowStart = event.timeStamp;
        g.teaseFlips = 0;
        g.teaseAccum = 0;
      }
      const dir = stepX > 0 ? 1 : stepX < 0 ? -1 : 0;
      if (dir !== 0) {
        if (dir === g.teaseDir) {
          g.teaseAccum += Math.abs(stepX);
        } else {
          if (g.teaseAccum >= 14) g.teaseFlips += 1;
          g.teaseDir = dir;
          g.teaseAccum = Math.abs(stepX);
        }
        if (g.teaseFlips >= 3) {
          g.teaseFlips = 0;
          g.teaseWindowStart = event.timeStamp;
          onTease();
        }
      }
    } else {
      g.teaseFlips = 0;
      g.teaseAccum = 0;
    }
    g.lastX = event.clientX;
    g.lastY = event.clientY;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) return;
    const el = event.currentTarget;
    const p = gesturePoint()!;
    gestureRef.current = null;
    if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);
    // The browser fires a click after pointerup; the press is already handled.
    suppressClickRef.current = true;
    setTimeout(() => (suppressClickRef.current = false), 0);

    if (g.moved < TAP_SLOP) {
      // A tap (touch, VoiceOver double-tap, quick click): give directly.
      setTransform(baseRef.current.x, baseRef.current.y);
      glideToMouthAndGive();
      return;
    }

    const target = getTargetRect();
    const cx = g.baseCx + (g.lastX - g.startX);
    const cy = g.baseCy + (g.lastY - g.startY);
    if (target) {
      const overHead =
        cx >= target.left + target.width * 0.15 &&
        cx <= target.right - target.width * 0.15 &&
        cy >= target.top - 48 &&
        cy < target.top + target.height * 0.18;
      if (overHead) {
        perchAt(target);
        return;
      }
      // Mouth-feeding needs the release at face height; a berry let go down
      // by the feet drops to the floor instead (where it may get gobbled).
      if (g.near && cy < target.bottom - target.height * 0.22) {
        onLook(null, null);
        onFeed();
        return;
      }
    }
    onDropped();
    launch(p, g.vx, g.vy);
  };

  /** Glide the berry to a spot on Sprig's head and report the perch. */
  const perchAt = (target: DOMRect) => {
    const el = buttonRef.current!;
    const home = homePoint();
    const px = target.left + target.width * 0.28 - home.x;
    const py = target.top + 4 - home.y;
    baseRef.current = { x: px, y: py };
    el.setAttribute('data-glide', 'true');
    requestAnimationFrame(() => setTransform(px, py));
    onLook(null, null); // perched gaze comes from the cross-eyed pose
    onPerched();
  };

  /** Tap/keyboard give: the berry glides to Sprig's mouth by itself. */
  const glideToMouthAndGive = () => {
    if (phase !== 'ready' && phase !== 'perched') return;
    const el = buttonRef.current;
    const target = getTargetRect();
    if (el && target) {
      const home = homePoint();
      const mx = target.left + target.width / 2 - home.x;
      const my = target.top + target.height * 0.4 - home.y;
      glideRef.current = true;
      el.setAttribute('data-glide', 'true');
      requestAnimationFrame(() => setTransform(mx, my));
    }
    onGive();
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) return;
    abortDrag();
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    glideToMouthAndGive(); // keyboard Enter/Space (no preceding pointer events)
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && phase === 'ready') onDismiss();
  };

  // Static poses serve phases that were never touched by a live gesture —
  // i.e. deterministic fixtures. Live berries keep their inline transforms.
  const posed = !liveRef.current && !glideRef.current;
  const pose = posed
    ? phase === 'held-near'
      ? 'near'
      : phase === 'perched'
        ? 'perch'
        : phase === 'gobbling'
          ? 'gobble'
          : undefined
    : undefined;

  return (
    <button
      ref={buttonRef}
      type="button"
      className="snack"
      aria-label="Give snack to Sprig"
      data-phase={phase}
      data-pose={pose}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="snack-body" aria-hidden="true">
        <span className="snack-spin">
          <svg viewBox="0 0 64 64">
            <defs>
              <radialGradient id="snack-berry" cx="0.38" cy="0.32" r="0.9">
                <stop offset="0" stopColor="#cf7a52" />
                <stop offset="0.55" stopColor="#b65a41" />
                <stop offset="1" stopColor="#8f4130" />
              </radialGradient>
            </defs>
            {/* contact shadow */}
            <ellipse
              className="snack-shadow"
              cx="32"
              cy="56"
              rx="15"
              ry="4"
              fill="rgba(8, 12, 10, 0.4)"
            />
            <g className="snack-berry">
              <circle cx="32" cy="38" r="16.5" fill="url(#snack-berry)" />
              {/* dimpled seeds, like a handmade berry */}
              <g fill="#eeb98d" opacity="0.6">
                <circle cx="26" cy="34" r="1.3" />
                <circle cx="35" cy="31" r="1.2" />
                <circle cx="40" cy="40" r="1.3" />
                <circle cx="30" cy="44" r="1.2" />
                <circle cx="37" cy="47" r="1.1" />
                <circle cx="23" cy="41" r="1.1" />
              </g>
              {/* soft highlight */}
              <ellipse
                cx="26"
                cy="30"
                rx="5.5"
                ry="3.6"
                fill="#e9a05f"
                opacity="0.5"
                transform="rotate(-24 26 30)"
              />
              {/* stem + leaf pair, same greens as the plant */}
              <path
                d="M32 22.5 C32 18.5 33 15.5 35 13"
                stroke="#5c7d42"
                strokeWidth="2.6"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M34.5 14 C29 8 21.5 8.5 17.5 11 C21 17 28.5 18.5 34 15 Z" fill="#659155" />
              <path
                d="M35.5 13.5 C39 7.5 45.5 6.5 50 8.5 C47.5 14.5 40.5 16.5 35.5 13.5 Z"
                fill="#4d6b3c"
              />
            </g>
          </svg>
        </span>
      </span>
    </button>
  );
}
