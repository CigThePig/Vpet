import type { RefObject } from 'react';
import type { HabitatState, TimeOfDay } from '../game/types';
import { effectiveReaction } from '../game/feed';
import { petReaction } from '../game/pet';
import { Creature } from './Creature';
import './habitat.css';

interface HabitatProps {
  state: HabitatState;
  /** Exposes the creature's on-screen box for snack-drop hit testing. */
  creatureAnchorRef?: RefObject<HTMLDivElement | null>;
}

/**
 * The room around the creature, built as layered CSS + inline SVG props.
 * Background: wall & window. Middle ground: lamp, plant, floor, rug, mess.
 * Focal point: the creature. Foreground: ambient motes and a soft vignette.
 */
export function Habitat({ state, creatureAnchorRef }: HabitatProps) {
  const { timeOfDay } = state;
  return (
    <div className="habitat" aria-hidden="true">
      <div className="habitat-wall" />
      <WindowScene time={timeOfDay} />
      <Shelf />
      <div className="habitat-floor" />
      <div className="habitat-rug" />
      {state.dirty && <Mess />}
      <div className="habitat-lamp-glow" />
      <Lamp time={timeOfDay} />
      <Plant />
      <div className="creature-anchor" ref={creatureAnchorRef}>
        <Creature
          mood={state.mood}
          sleeping={state.sleeping}
          dirty={state.dirty}
          time={timeOfDay}
          // Petting and feeding are mutually exclusive (one tray category at
          // a time), so whichever interaction is live provides the reaction.
          reaction={
            state.petting !== 'none' ? petReaction(state.petting) : effectiveReaction(state)
          }
        />
      </div>
      <AmbientMotes time={timeOfDay} />
      <div className="habitat-vignette" />
    </div>
  );
}

function WindowScene({ time }: { time: TimeOfDay }) {
  const night = time === 'night';
  return (
    <svg className="habitat-window" viewBox="0 0 160 214">
      <defs>
        <linearGradient id="sky-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4c987" />
          <stop offset="0.55" stopColor="#e9a05f" />
          <stop offset="1" stopColor="#c97a4e" />
        </linearGradient>
        <linearGradient id="sky-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2c49" />
          <stop offset="1" stopColor="#0d1728" />
        </linearGradient>
        <clipPath id="window-clip">
          <path d="M12 202 L12 82 A68 68 0 0 1 148 82 L148 202 Z" />
        </clipPath>
      </defs>
      <path
        d="M12 202 L12 82 A68 68 0 0 1 148 82 L148 202 Z"
        fill={night ? 'url(#sky-night)' : 'url(#sky-day)'}
      />
      <g clipPath="url(#window-clip)">
        {night ? (
          <g>
            <path d="M96 52 A26 26 0 1 0 118 92 A22 22 0 0 1 96 52 Z" fill="#e8dfc6" />
            <g fill="#cfd8e6" className="window-stars">
              <circle cx="42" cy="60" r="1.7" />
              <circle cx="60" cy="96" r="1.2" />
              <circle cx="124" cy="128" r="1.5" />
              <circle cx="34" cy="130" r="1.2" />
              <circle cx="132" cy="58" r="1.1" />
              <circle cx="78" cy="140" r="1.3" />
            </g>
          </g>
        ) : (
          <g>
            <circle cx="52" cy="104" r="17" fill="#ffe2a8" opacity="0.95" />
            <circle cx="52" cy="104" r="26" fill="#ffd98f" opacity="0.28" />
          </g>
        )}
        <path
          d="M0 168 Q40 138 76 158 Q116 178 160 150 L160 214 L0 214 Z"
          fill={night ? '#101c1c' : '#8a5f42'}
        />
        <path
          d="M0 186 Q52 162 104 180 Q136 190 160 182 L160 214 L0 214 Z"
          fill={night ? '#0b1414' : '#6d4a35'}
        />
      </g>
      <path
        d="M12 202 L12 82 A68 68 0 0 1 148 82 L148 202"
        fill="none"
        stroke="#221d16"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line x1="12" y1="148" x2="148" y2="148" stroke="#221d16" strokeWidth="5" />
      <rect x="4" y="200" width="152" height="11" rx="5" fill="#2c2317" />
    </svg>
  );
}

function Lamp({ time }: { time: TimeOfDay }) {
  const night = time === 'night';
  return (
    <svg className="habitat-lamp" viewBox="0 0 120 224">
      <ellipse cx="60" cy="212" rx="27" ry="9" fill="#221c14" />
      <rect x="56.5" y="92" width="7" height="120" rx="3.5" fill="#3d342a" />
      <path d="M32 92 L88 92 L76 38 L44 38 Z" fill="#a5573e" />
      <path d="M32 92 L88 92 L85 82 L35 82 Z" fill="#8f4834" opacity="0.7" />
      <ellipse cx="60" cy="93" rx="27" ry="6.5" fill={night ? '#ffd28a' : '#f7bd76'} />
      <ellipse cx="60" cy="93" rx="16" ry="4" fill="#ffe9bd" opacity={night ? 1 : 0.85} />
    </svg>
  );
}

function Plant() {
  return (
    <svg className="habitat-plant" viewBox="0 0 140 190">
      <g className="plant-leaves">
        <path d="M70 140 C66 108 44 96 26 92 C34 122 48 136 66 142 Z" fill="#4d6b3c" />
        <path d="M70 140 C74 104 96 90 116 88 C110 120 92 136 74 142 Z" fill="#587a45" />
        <path d="M70 142 C62 110 58 84 66 58 C82 82 84 116 76 142 Z" fill="#659155" />
        <path d="M70 142 C58 122 40 118 28 122 C40 140 56 146 68 144 Z" fill="#425c34" />
        <path d="M72 142 C86 124 102 122 114 126 C102 142 84 148 74 144 Z" fill="#4d6b3c" />
      </g>
      <path d="M44 138 L96 138 L88 184 L52 184 Z" fill="#7d5138" />
      <rect x="40" y="132" width="60" height="13" rx="6" fill="#8f5e40" />
      <ellipse cx="70" cy="138" rx="24" ry="4" fill="#4a3421" />
    </svg>
  );
}

function Shelf() {
  return (
    <svg className="habitat-shelf" viewBox="0 0 120 74">
      {/* jar with a resting sprout clipping */}
      <path d="M28 24 h16 v4 h-16 Z" fill="#5c6e63" />
      <path d="M26 28 h20 q3 10 0 24 h-20 q-3 -14 0 -24 Z" fill="#93a89b" opacity="0.5" />
      <path d="M36 28 C35 20 30 15 23 14 C25 22 30 27 36 28 Z" fill="#659155" />
      {/* leaning books */}
      <rect x="66" y="20" width="9" height="33" rx="2" fill="#8a5540" />
      <rect x="77" y="24" width="8" height="29" rx="2" fill="#586b4a" />
      <path d="M89 53 L104 20 L112 23 L98 55 Z" fill="#9c7a4e" />
      {/* plank + brackets */}
      <rect x="8" y="53" width="104" height="8" rx="3" fill="#3e332a" />
      <path d="M20 61 l4 8 h-8 Z M96 61 l4 8 h-8 Z" fill="#2e2620" />
    </svg>
  );
}

function Mess() {
  return (
    <svg className="habitat-mess" viewBox="0 0 90 46">
      <ellipse cx="45" cy="36" rx="34" ry="9" fill="#4f4030" />
      <ellipse cx="34" cy="32" rx="12" ry="6" fill="#5d4b36" />
      <ellipse cx="58" cy="34" rx="9" ry="5" fill="#463823" />
      <path
        d="M30 22 q4 -7 0 -12 M45 24 q4 -8 0 -14 M60 23 q4 -7 0 -12"
        stroke="#8a927f"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
        className="mess-waft"
      />
    </svg>
  );
}

/** Deterministic ambient particles: dust motes by day, fireflies by night. */
const MOTES = [
  { left: '16%', top: '30%', delay: '0s', scale: 1 },
  { left: '30%', top: '48%', delay: '-1.3s', scale: 0.8 },
  { left: '44%', top: '24%', delay: '-2.6s', scale: 1.15 },
  { left: '58%', top: '42%', delay: '-0.7s', scale: 0.7 },
  { left: '70%', top: '30%', delay: '-3.4s', scale: 1 },
  { left: '82%', top: '52%', delay: '-1.9s', scale: 0.85 },
  { left: '24%', top: '60%', delay: '-4.1s', scale: 0.75 },
  { left: '76%', top: '64%', delay: '-2.2s', scale: 1.05 },
];

function AmbientMotes({ time }: { time: TimeOfDay }) {
  return (
    <div className="habitat-motes">
      {MOTES.map((m, i) => (
        <span
          key={i}
          className={time === 'night' ? 'mote mote--firefly' : 'mote'}
          style={{
            left: m.left,
            top: m.top,
            animationDelay: m.delay,
            transform: `scale(${m.scale})`,
          }}
        />
      ))}
    </div>
  );
}
