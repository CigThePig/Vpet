import './toast.css';

/**
 * Transient, low-key development message. Rendered permanently as a live
 * region so screen readers announce updates; visually present only while a
 * message is active.
 */
export function Toast({ message }: { message: string | null }) {
  return (
    <div className="toast" role="status" aria-live="polite" data-visible={message != null}>
      {message}
    </div>
  );
}
