/** The popup shown when someone tries a sixth top interest (spec 4.14). Dismissed by the button or by tapping the dimmed area. */
export function TopLimitModal({ max, onClose }: { max: number; onClose: () => void }) {
  return (
    <div className="ob2-mbg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ob2-modal" role="alertdialog" aria-labelledby="ob2-mt" aria-modal="true">
        <div className="mi" aria-hidden="true">★</div>
        <h3 id="ob2-mt">You already have {max} top interests</h3>
        <p>Deselect an interest above to add a new top interest.</p>
        <button type="button" className="ob2-btn" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}
