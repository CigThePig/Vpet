import './journal.css';

/** Small, unobtrusive entry point for the future journal / settings area. */
export function JournalButton({ onActivate }: { onActivate: () => void }) {
  return (
    <button
      type="button"
      className="journal-button"
      aria-label="Journal and settings"
      onClick={onActivate}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 4.5 h11 a1.5 1.5 0 0 1 1.5 1.5 v12 a1.5 1.5 0 0 1 -1.5 1.5 h-11 a1.5 1.5 0 0 1 -1.5 -1.5 v-12 a1.5 1.5 0 0 1 1.5 -1.5 Z" />
        <path d="M8.5 4.5 v15" />
        <path d="M12 9 h4 M12 12.5 h4" opacity="0.7" />
      </svg>
    </button>
  );
}
