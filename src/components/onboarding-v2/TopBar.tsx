/** The thin bar at the top of every screen: an optional back arrow and the progress fill. */
export function TopBar({ onBack, percent }: { onBack?: () => void; percent: number }) {
  return (
    <div className="ob2-top">
      {onBack && (
        <button type="button" className="ob2-back" onClick={onBack} aria-label="Back">
          ‹
        </button>
      )}
      <div className="ob2-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
