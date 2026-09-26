/** A plain checkmark that inherits its color from context (CSS `color`) —
 * used wherever a control needs to read as "off/gray, then green once
 * confirmed" purely through a color transition, not an icon swap. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="check-icon">
      <polyline points="4 13 9 18 20 6" />
    </svg>
  );
}
