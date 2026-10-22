import { bandDims, careCount, careHas, careItemsFor, careRowSummary, isNarrowed, type Bands, type CareItem, type CareState } from '@/lib/onboarding/care';

/**
 * The collapsed "What else matters when you choose?" line (spec 5.3). Open, it is a list of rows, one per item. Each row shows one chip with
 * what is picked, or "No preference" until something is. Tapping a row opens its choices right there, under it.
 */
export function CareAccordion({
  scope,
  care,
  bands,
  open,
  tiles,
  kidsSuggested,
  bare,
  onOpen,
  onTile,
  onBandChoice,
  onOption,
  onFirm,
  onAddKids,
}: {
  scope: 'trip' | 'dna';
  care: CareState;
  bands: Bands;
  open: boolean;
  /** The rows that are open. */
  tiles: string[];
  kidsSuggested: boolean;
  /** In a sheet: no collapsible header and no suggestion line, just the open rows. */
  bare?: boolean;
  onOpen: () => void;
  onTile: (key: string) => void;
  onBandChoice: (dim: string, band: string) => void;
  onBandReset?: (dim: string) => void;
  onOption: (item: CareItem, option: string) => void;
  onFirm: (key: string, firm: boolean) => void;
  onClear?: (key: string) => void;
  onAddKids: () => void;
}) {
  const items = careItemsFor(scope);
  const n = careCount(care, bands);
  return (
    <>
      {kidsSuggested && !bare && (
        <div className="ob2-sugg">
          <span>Traveling with kids? Add ages and we will favor family-friendly places.</span>
          <button type="button" className="ob2-link" onClick={onAddKids}>
            Add kid-friendly
          </button>
        </div>
      )}
      <div className="ob2-care">
        {!bare && (
          <button type="button" className="carehd" aria-expanded={open} onClick={onOpen}>
            <span>
              <b>What else matters when you choose?</b>
              {!open && <small>{n ? `${n} of ${items.length} selected` : 'Optional: kids, food needs, language, travel modes and more.'}</small>}
            </span>
            <i aria-hidden="true">{open ? '▾' : '▸'}</i>
          </button>
        )}
        {(open || bare) && (
          <>
            <div className="crows">
              {items.map((c) => {
                const on = careHas(c, care, bands);
                const sel = tiles.includes(c.key);
                const v = care[c.key];
                return (
                  <div key={c.key} className={`crow ${on ? 'on' : ''} ${sel ? 'sel' : ''}`}>
                    <button type="button" className="crh" aria-expanded={sel} onClick={() => onTile(c.key)}>
                      <span className="e" aria-hidden="true">{c.icon}</span>
                      <span className="t">
                        <b>{c.name}</b>
                        <small>{c.detail}</small>
                      </span>
                      {!sel && <span className={`sumchip ${on ? 'on' : ''}`}>{careRowSummary(c, care, bands)}</span>}
                      <i aria-hidden="true">{sel ? '▴' : '▾'}</i>
                    </button>
                    {sel && (
                      <div className="crb">
                        {c.band ? (
                          <>
                            <div className="ob2-fine" style={{ margin: 0 }}>Pick any that sound good. Untick them all for no preference.</div>
                            <div className="ob2-chips">
                              {bandDims()
                                .find((x) => x.key === c.key)!
                                .bands.map((b) => {
                                  const set = isNarrowed(bands, c.key) ? bands[c.key] : [];
                                  return (
                                    <button key={b.key} type="button" className={`ob2-chip ${set.includes(b.key) ? 'on' : ''}`} aria-pressed={set.includes(b.key)} onClick={() => onBandChoice(c.key, b.key)}>
                                      {b.label}
                                    </button>
                                  );
                                })}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="ob2-fine" style={{ margin: 0 }}>Pick any that apply. Untick them all for no preference.</div>
                            <div className="ob2-chips">
                              {c.options!.map(([o, l]) => (
                                <button key={o} type="button" className={`ob2-chip ${v?.o.includes(o) ? 'on' : ''}`} aria-pressed={!!v?.o.includes(o)} onClick={() => onOption(c, o)}>
                                  {l}
                                </button>
                              ))}
                            </div>
                            {c.firm && v && v.o.length > 0 && (
                              <div className="ob2-seg2">
                                <button type="button" className={!v.firm ? 'on' : ''} onClick={() => onFirm(c.key, false)}>
                                  Nice to have
                                </button>
                                <button type="button" className={v.firm ? 'on' : ''} onClick={() => onFirm(c.key, true)}>
                                  {c.firm}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="ob2-fine">Budget, dates and who is coming are asked separately. Only what you pick here is used.</div>
          </>
        )}
      </div>
    </>
  );
}
