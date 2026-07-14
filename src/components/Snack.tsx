import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { SnackPhase } from '../game/types';
import './snack.css';

interface SnackProps {
  /** Current lifecycle phase (only ready/held/held-near/returning render). */
  phase: SnackPhase;
  /** The player picked the snack up with a pointer. */
  onGrab: () => void;
  /** The carried snack entered/left Sprig's feeding area. */
  onNearChange: (near: boolean) => void;
  /** The pointer was released after a real drag. */
  onRelease: () => void;
  /** Tap or keyboard activation: give the snack directly (auto-flight). */
  onGive: () => void;
  /** The drag was interrupted (Escape, pointer cancel, window blur). */
  onCancelDrag: () => void;
  /** Escape while resting: put the snack away. */
  onDismiss: () => void;
  /** Sprig's on-screen box, for near-target detection. */
  getTargetRect: () => DOMRect | null;
  /** Live eye-tracking vector (−1..1), or null to clear. */
  onLook: (x: number | null, y: number | null) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

/** Movement below this (px) counts as a tap, which gives the snack directly. */
const TAP_SLOP = 8;
/** The feeding area: Sprig's box grown by this margin (px). */
const TARGET_MARGIN = 14;

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
}

/**
 * The one draggable snack: a small berry living in the habitat.
 *
 * Interaction model: Pointer Events with pointer capture, so the drag
 * survives leaving the button's bounds and fast pointer movement. Position
 * updates during a drag go straight to the DOM (style.transform) — React
 * state only changes on lifecycle transitions, never per move. A press that
 * never travels (tap, VoiceOver double-tap, keyboard Enter/Space) gives the
 * snack directly: it glides to Sprig on its own, producing the same feeding
 * result as a drag.
 */
export function Snack({
  phase,
  onGrab,
  onNearChange,
  onRelease,
  onGive,
  onCancelDrag,
  onDismiss,
  getTargetRect,
  onLook,
  buttonRef,
}: SnackProps) {
  const gestureRef = useRef<Gesture | null>(null);
  const liveReturnRef = useRef(false);
  const suppressClickRef = useRef(false);
  // Keep callbacks fresh for the window-level listeners without re-binding.
  const callbacksRef = useRef({ onCancelDrag, onLook });
  callbacksRef.current = { onCancelDrag, onLook };

  const dragging = gestureRef.current != null;

  // When the snack settles back to 'ready', clear any leftover drag styling.
  useEffect(() => {
    if (phase === 'ready') {
      liveReturnRef.current = false;
      const el = buttonRef.current;
      if (el) {
        el.removeAttribute('data-live-return');
        el.style.transform = '';
      }
    }
  }, [phase, buttonRef]);

  /** Interrupt a live drag: glide home and tell the app it was cancelled. */
  const abortDrag = () => {
    const el = buttonRef.current;
    const g = gestureRef.current;
    if (!el || !g) return;
    gestureRef.current = null;
    if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);
    startLiveReturn(el);
    callbacksRef.current.onLook(null, null);
    callbacksRef.current.onCancelDrag();
  };

  /** Animate the (already transformed) snack back to its resting spot. */
  const startLiveReturn = (el: HTMLButtonElement) => {
    liveReturnRef.current = true;
    el.setAttribute('data-live-return', 'true');
    // Two frames so the transition sees a start value before the end value.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (liveReturnRef.current) el.style.transform = 'translate3d(0, 0, 0)';
      });
    });
  };

  // Window-level interruption handling, active only while dragging.
  useEffect(() => {
    if (!dragging && phase !== 'held' && phase !== 'held-near') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') abortDrag();
    };
    const onBlur = () => abortDrag();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dragging]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || phase !== 'ready' || gestureRef.current) return;
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    const rect = el.getBoundingClientRect();
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseCx: rect.left + rect.width / 2,
      baseCy: rect.top + rect.height / 2,
      moved: 0,
      near: false,
    };
    onGrab();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    g.moved = Math.max(g.moved, Math.hypot(dx, dy));
    event.currentTarget.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

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
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) return;
    const el = event.currentTarget;
    gestureRef.current = null;
    if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);
    // The browser fires a click after pointerup; the press is already handled.
    suppressClickRef.current = true;
    setTimeout(() => (suppressClickRef.current = false), 0);
    onLook(null, null);

    if (g.moved < TAP_SLOP) {
      // A tap (touch, VoiceOver double-tap, quick click): give directly.
      el.style.transform = '';
      onGive();
      return;
    }
    if (!g.near) startLiveReturn(el);
    onRelease();
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
    onGive(); // keyboard Enter/Space (no preceding pointer sequence)
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && phase === 'ready') onDismiss();
  };

  // Static poses for phases that were not produced by a live gesture
  // (deterministic fixtures, and the tap/keyboard auto-flight).
  const posed = !gestureRef.current && !liveReturnRef.current;
  const pose =
    posed && phase === 'held-near' ? 'near' : posed && phase === 'returning' ? 'return' : undefined;

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
    </button>
  );
}
