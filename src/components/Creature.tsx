import type { Mood, TimeOfDay } from '../game/types';
import type { SnackReaction } from '../game/feed';
import './creature.css';

interface CreatureProps {
  mood: Mood;
  sleeping: boolean;
  dirty: boolean;
  time: TimeOfDay;
  /** How Sprig is responding to the snack; overrides the mood face. */
  reaction?: SnackReaction;
}

type EyeStyle = 'open' | 'happy' | 'droop' | 'heavy' | 'closed';
type MouthStyle = 'smile' | 'grin' | 'frown' | 'yawn' | 'flat' | 'rest' | 'open' | 'chew';

/**
 * Sprig — a small sprout-topped gumdrop creature, drawn as inline SVG so its
 * face, posture and markings can respond to state without image assets.
 */
export function Creature({ mood, sleeping, dirty, time, reaction = 'none' }: CreatureProps) {
  let eyes: EyeStyle = 'open';
  let mouth: MouthStyle = 'smile';
  if (sleeping) {
    eyes = 'closed';
    mouth = 'rest';
  } else if (mood === 'happy') {
    eyes = 'happy';
    mouth = 'grin';
  } else if (mood === 'hungry') {
    eyes = 'droop';
    mouth = 'frown';
  } else if (mood === 'tired') {
    eyes = 'heavy';
    mouth = 'yawn';
  } else if (dirty) {
    mouth = 'flat';
  }

  // The snack response takes over the face while it is happening.
  if (reaction === 'notice') {
    eyes = 'open';
    mouth = 'smile';
  } else if (reaction === 'anticipate') {
    eyes = 'open';
    mouth = 'open';
  } else if (reaction === 'eating') {
    eyes = 'closed';
    mouth = 'chew';
  } else if (reaction === 'satisfied') {
    eyes = 'happy';
    mouth = 'grin';
  } else if (reaction === 'missed') {
    eyes = 'open';
    mouth = 'rest';
  }

  const leafDroop = reaction === 'none' && (sleeping || mood === 'hungry' || mood === 'tired');

  return (
    <div
      className="creature"
      data-mood={mood}
      data-sleeping={sleeping}
      data-time={time}
      data-reaction={reaction}
    >
      <svg className="creature-svg" viewBox="0 0 220 200">
        <defs>
          <radialGradient id="sprig-body" cx="0.42" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#f3e7c8" />
            <stop offset="0.7" stopColor="#ecdcba" />
            <stop offset="1" stopColor="#dcc59c" />
          </radialGradient>
        </defs>

        {/* contact shadow (outside the breathing group so it stays put) */}
        <ellipse cx="110" cy="182" rx="64" ry="10" fill="rgba(8, 12, 10, 0.35)" />

        <g className="creature-body-group">
          {/* sprout */}
          <g
            className="creature-leaf"
            style={{ transform: leafDroop ? 'rotate(24deg)' : undefined }}
          >
            <path
              d="M110 52 C109 40 109 34 111 26"
              stroke="#5c7d42"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M111 27 C103 12 88 8 76 10 C80 24 94 32 110 28 Z" fill="#6f9a4f" />
            <path d="M112 26 C117 13 128 8 139 10 C136 23 125 30 113 28 Z" fill="#7fae5c" />
          </g>

          {/* feet */}
          <ellipse cx="84" cy="176" rx="15" ry="8" fill="#ddc79f" />
          <ellipse cx="136" cy="176" rx="15" ry="8" fill="#ddc79f" />

          {/* body */}
          <path
            d="M110 48 C68 48 48 86 46 124 C44.4 154 62 176 110 176 C158 176 175.6 154 174 124 C172 86 152 48 110 48 Z"
            fill="url(#sprig-body)"
          />

          {/* arms */}
          <ellipse cx="57" cy="130" rx="8.5" ry="15" fill="#e6d2ab" transform="rotate(16 57 130)" />
          <ellipse
            cx="163"
            cy="130"
            rx="8.5"
            ry="15"
            fill="#e6d2ab"
            transform="rotate(-16 163 130)"
          />

          {/* belly */}
          <ellipse cx="110" cy="138" rx="42" ry="30" fill="#f6ecd4" opacity="0.85" />

          {/* dirt smudges */}
          {dirty && (
            <g fill="#6b5a44" opacity="0.5">
              <path d="M70 96 q8 -6 14 2 q-2 8 -12 6 q-8 -2 -2 -8 Z" />
              <path d="M140 148 q10 -4 14 4 q-4 8 -13 4 q-7 -3 -1 -8 Z" />
              <path d="M96 160 q6 -5 11 0 q0 7 -9 6 q-7 -1 -2 -6 Z" />
            </g>
          )}

          {/* face */}
          <g className="creature-face">
            <Eyes style={eyes} />
            {/* puffed cheeks while munching */}
            {reaction === 'eating' && (
              <g fill="#f6ecd4" opacity="0.9">
                <circle cx="94" cy="114" r="9" />
                <circle cx="126" cy="114" r="9" />
              </g>
            )}
            <Mouth style={mouth} />
            <ellipse cx="72" cy="116" rx="8" ry="5" fill="#d98a5f" opacity="0.32" />
            <ellipse cx="148" cy="116" rx="8" ry="5" fill="#d98a5f" opacity="0.32" />
          </g>
        </g>

        {/* a few honest crumbs after the snack */}
        {reaction === 'satisfied' && (
          <g className="creature-crumbs" fill="#b65a41">
            <circle cx="92" cy="184" r="2.4" />
            <circle cx="118" cy="188" r="1.8" />
            <circle cx="106" cy="181" r="1.4" opacity="0.8" />
          </g>
        )}

        {sleeping && (
          <g className="creature-zzz" fill="#cfd8e6" fontFamily="inherit" fontWeight="600">
            <text x="156" y="66" fontSize="13">
              z
            </text>
            <text x="168" y="48" fontSize="17">
              z
            </text>
            <text x="183" y="28" fontSize="21">
              z
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function Eyes({ style }: { style: EyeStyle }) {
  const eyeFill = '#33291f';
  if (style === 'happy') {
    return (
      <g stroke={eyeFill} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M77 96 Q86 87 95 96" />
        <path d="M125 96 Q134 87 143 96" />
      </g>
    );
  }
  if (style === 'closed') {
    return (
      <g stroke={eyeFill} strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M78 95 Q86 101 94 95" />
        <path d="M126 95 Q134 101 142 95" />
      </g>
    );
  }
  const heavy = style === 'heavy';
  const droop = style === 'droop';
  if (heavy) {
    // Half-closed eyes: only the lower half of each pupil shows, with a
    // heavy lid line resting on top.
    return (
      <g>
        <path d="M78 94 A8 8 0 0 0 94 94 Z" fill={eyeFill} />
        <path d="M126 94 A8 8 0 0 0 142 94 Z" fill={eyeFill} />
        <path
          d="M77 93.5 Q86 96.5 95 93.5 M125 93.5 Q134 96.5 143 93.5"
          stroke={eyeFill}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }
  return (
    <g>
      {/* Pupils sit in a group the CSS shifts via --look-x/--look-y so Sprig
          can watch the snack travel. */}
      <g className="creature-pupils">
        <circle cx="86" cy="94" r="8" fill={eyeFill} />
        <circle cx="134" cy="94" r="8" fill={eyeFill} />
        <g fill="#ffffff">
          <circle cx="83.5" cy="91" r="2.6" />
          <circle cx="131.5" cy="91" r="2.6" />
          <circle cx="89" cy="96.5" r="1.2" opacity="0.8" />
          <circle cx="137" cy="96.5" r="1.2" opacity="0.8" />
        </g>
      </g>
      {droop && (
        <g stroke="#8a7350" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9">
          {/* worried brows */}
          <path d="M76 80 Q84 76 93 80" />
          <path d="M127 80 Q136 76 144 80" />
        </g>
      )}
    </g>
  );
}

function Mouth({ style }: { style: MouthStyle }) {
  const stroke = '#7a6242';
  switch (style) {
    case 'grin':
      return <path d="M96 110 Q110 128 124 110 Q110 118 96 110 Z" fill="#7a5240" />;
    case 'open':
      // Expectant little "o" — Sprig is ready for the snack.
      return (
        <g>
          <ellipse cx="110" cy="115" rx="8" ry="9.5" fill="#7a5240" />
          <ellipse cx="110" cy="119" rx="4.5" ry="3.5" fill="#d98a5f" opacity="0.85" />
        </g>
      );
    case 'chew':
      return (
        <g className="creature-chew">
          <ellipse cx="110" cy="114" rx="7" ry="5.5" fill="#7a5240" />
        </g>
      );
    case 'frown':
      return (
        <path
          d="M101 118 Q110 111 119 118"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'yawn':
      return <ellipse cx="110" cy="116" rx="6.5" ry="8" fill="#7a5240" />;
    case 'flat':
      return (
        <path
          d="M102 114 L118 114"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'rest':
      return (
        <path
          d="M104 113 Q110 117 116 113"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'smile':
    default:
      return (
        <path
          d="M100 112 Q110 121 120 112"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}
