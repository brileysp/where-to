import {
  bandDims, careCount, carePicks, careSummary, careItemsFor, careHas, isNarrowed, type Bands, type CareItem, type CareState,
} from '@/lib/onboarding/care';

/**
 * The collapsed "What else matters when you choose?" line (spec 5.3). Open, it shows a grid of tiles; tapping a tile opens a small editor
 * under the grid (several can be open at once), then "Your picks" as removable chips.
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
  onBandReset,
  onOption,
  onFirm,
  onClear,
  onRemovePick,
  onAddKids,
}: {
  scope: 'trip' | 'dna';
  care: CareState;
  bands: Bands;
  open: boolean;
  tiles: string[];
  kidsSuggested: boolean;
  /** In a sheet: no collapsible header and no suggestion line, just the open grid. */
  bare?: boolean;
  onOpen: () => void;
  onTile: (key: string) => void;
  onBandChoice: (dim: string, band: string) => void;
  onBandReset: (dim: string) => void;
  onOption: (item: CareItem, option: string) => void;
  onFirm: (key: string, firm: boolean) => void;
  onClear: (key: string) => void;
  onRemovePick: (index: number) => void;
  onAddKids: () => void;
}) {
  const items = careItemsFor(scope);
  const n = careCount(care, bands);
  const picks = carePicks(care, bands, scope);
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
            <small>{n ? careSummary(care, bands).join(' · ') : 'Optional: kids, food needs, language, travel modes and more.'}</small>
          </span>
          <i aria-hidden="true">{open ? '▾' : '▸'}</i>
        </button>
        )}
        {(open || bare) && (
          <>
            <div className="cgrid">
              {items.map((c) => {
                const on = careHas(c, care, bands);
                const sel = tiles.includes(c.key);
                return (
                  <button key={c.key} type="button" className={`ct ${on ? 'on' : ''} ${sel ? 'sel' : ''}`} aria-expanded={sel} onClick={() => onTile(c.key)}>
                    <span className="e" aria-hidden="true">{c.icon}</span>
                    <span className="t">
                      <b>{c.name}</b>
                      <small>{c.detail}</small>
                    </span>
                    {on ? <i aria-hidden="true">✓</i> : sel ? <i aria-hidden="true">▾</i> : null}
                  </button>
                );
              })}
            </div>
            {items
              .filter((c) => tiles.includes(c.key))
              .map((c) => {
                if (c.band) {
                  const d = bandDims().find((x) => x.key === c.key)!;
                  const set = isNarrowed(bands, c.key) ? bands[c.key] : [];
                  return (
                    <div key={c.key} className="ced">
                      <div className="row">
                        <b>
                          {c.icon} {c.name}
                        </b>
                        {isNarrowed(bands, c.key) && (
                          <button type="button" className="ob2-link" onClick={() => onBandReset(c.key)}>
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="ob2-fine" style={{ margin: 0 }}>Pick any that sound good. Pick none for no preference.</div>
                      <div className="ob2-chips">
                        {d.bands.map((b) => (
                          <button key={b.key} type="button" className={`ob2-chip ${set.includes(b.key) ? 'on' : ''}`} aria-pressed={set.includes(b.key)} onClick={() => onBandChoice(c.key, b.key)}>
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                const v = care[c.key];
                return (
                  <div key={c.key} className="ced">
                    <div className="row">
                      <b>
                        {c.icon} {c.name}
                      </b>
                      {v && v.o.length > 0 && (
                        <button type="button" className="ob2-link" onClick={() => onClear(c.key)}>
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="ob2-fine" style={{ margin: 0 }}>Pick any that apply.</div>
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
                  </div>
                );
              })}
            {picks.length > 0 && (
              <div className="ob2-picks">
                <div className="ob2-lbl" style={{ margin: 0 }}>Your picks · {picks.length}</div>
                <div className="ob2-chips">
                  {picks.map((p, i) => (
                    <button key={`${p.item.key}:${p.option}`} type="button" className="ob2-chip on pk" aria-label={`Remove ${p.label}`} onClick={() => onRemovePick(i)}>
                      {p.item.icon} {p.label} <i aria-hidden="true">✕</i>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ob2-fine">Budget, dates and who is coming are asked separately. Only what you pick here is used.</div>
          </>
        )}
      </div>
    </>
  );
}
