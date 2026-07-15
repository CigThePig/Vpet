import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { PetPhase } from '../game/types';
import './petzone.css';

interface PetZoneProps {
  /** Current petting phase (the zone renders only for ready/stroking). */
  phase: PetPhase;
  /** The hand came down on Sprig: a stroke begins. */
  onBegin: () => void;
  /** Live stroke position over Sprig (−1..1 horizontally), null to clear. */
  onStroke: (x: number | null) => void;
  /** The hand lifted before Sprig had enough. */
  onRest: () => void;
  /** Enough accumulated stroking: Sprig melts. */
  onBliss: () => void;
  /** Tap or keyboard activation: a single pat completes the petting. */
  onPat: () => void;
  /** Escape while resting: put Care away. */
  onDismiss: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

/** Movement below this (px) counts as a pat, which pets directly. */
const TAP_SLOP = 8;
/** Accumulated stroke distance (px) that melts Sprig into bliss. */
const STROKE_TARGET = 420;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** Furthest distance travelled, to distinguish pats from strokes. */
  moved: number;
}

/**
 * The pettable area: an invisible button over Sprig's body, present only
 * while Care mode is active. Sprig itself is the world object here — there
 * is nothing to carry, so unlike the Snack this zone never moves; it only
 * reads strokes. Pointer Events with capture drive the gesture; stroke
 * position goes straight to a CSS variable (Sprig leans toward the hand) and
 * React state changes only on lifecycle transitions. Accumulated warmth is a
 * live gesture detail kept here (never in HabitatState), and it carries
 * across separate strokes within one Care session. A press that never
 * travels (tap, VoiceOver double-tap, keyboard Enter/Space) is a pat, which
 * completes the petting the same way a full stroke session does.
 */
export function PetZone({
  phase,
  onBegin,
  onStroke,
  onRest,
  onBliss,
  onPat,
  onDismiss,
  buttonRef,
}: PetZoneProps) {
  const gestureRef = useRef<Gesture | null>(null);
  /** Total stroke distance so far this Care session. */
  const warmthRef = useRef(0);
  const suppressClickRef = useRef(false);

  /** Interrupt a live stroke (Escape, pointer cancel, blur): hand rests. */
  const abortStroke = () => {
    const el = buttonRef.current;
    const g = gestureRef.current;
    if (!el || !g) return;
    gestureRef.current = null;
    if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);
    onStroke(null);
    onRest();
  };
  const abortRef = useRef(abortStroke);
  abortRef.current = abortStroke;

  // Window-level interruption handling, active only while stroking.
  useEffect(() => {
    if (phase !== 'stroking') return;
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
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: 0,
    };
    onBegin();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) return;
    g.moved = Math.max(g.moved, Math.hypot(event.clientX - g.startX, event.clientY - g.startY));
    warmthRef.current += Math.hypot(event.clientX - g.lastX, event.clientY - g.lastY);
    g.lastX = event.clientX;
    g.lastY = event.clientY;

    // Sprig leans toward wherever the hand is stroking.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    onStroke(Math.max(-1, Math.min(1, x)));

    if (warmthRef.current >= STROKE_TARGET) {
      const el = event.currentTarget;
      gestureRef.current = null;
      if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);
      onStroke(null);
      onBliss();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) {
      // A release after an aborted stroke (Escape/cancel). Unlike the snack,
      // the zone never moves out from under the pointer, so the browser will
      // still fire a click — swallow it so it cannot register as a pat.
      suppressClickRef.current = true;
      setTimeout(() => (suppressClickRef.current = false), 0);
      return;
    }
    const el = event.currentTarget;
    gestureRef.current = null;
    if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);
    // The browser fires a click after pointerup; the press is already handled.
    suppressClickRef.current = true;
    setTimeout(() => (suppressClickRef.current = false), 0);
    onStroke(null);
    if (g.moved < TAP_SLOP) {
      onPat();
    } else {
      onRest();
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g || event.pointerId !== g.pointerId) return;
    abortStroke();
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onPat(); // keyboard Enter/Space (no preceding pointer events)
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && phase === 'ready') onDismiss();
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className="pet-zone"
      aria-label="Pet Sprig"
      data-phase={phase}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  );
}
