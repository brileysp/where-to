import { useEffect } from 'react';

/** A short message at the bottom of the screen that goes away by itself. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div className="ob2-toast" role="status">
      {message}
    </div>
  );
}
