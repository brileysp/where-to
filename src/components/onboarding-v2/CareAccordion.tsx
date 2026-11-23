import { useEffect, useRef } from 'react';
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
  bare,
  onOpen,
  onTile,
  onBandChoice,
  onOption,
  onFirm,
}: {
  scope: 'trip' | 'dna';
  care: CareState;
  bands: Bands;
  open: boolean;
  /** The rows that are open. */
  tiles: string[];
  /** In a sheet: no collapsible header, just the open rows. */
  bare?: boolean;
  onOpen: () => void;
  onTile: (key: string) => void;
  onBandChoice: (dim: string, band: string) => void;
  onBandReset?: (dim: string) => void;
  onOption: (item: CareItem, option: string) => void;
  onFirm: (key: string, firm: boolean) => void;
  onClear?: (key: string) => void;
}) {
  const items = careItemsFor(scope);
  const n = careCount(care, bands);
  // Opening the section brings its top to the top of the screen, so the rows start where the heading was.
  const box = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current && !bare) {
      const t = setTimeout(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      wasOpen.current = open;
      return () => clearTimeout(t);
    }
    wasOpen.current = open;
  }, [open, bare]);
  return (
    <>
      <div className={`ob2-care${open && !bare ? ' open' : ''}`} ref={box}>
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
            <div className="ob2-fine">Budget, dates and who’s coming are asked separately. Only what you pick here is used.</div>
          </>
        )}
      </div>
    </>
  );
}
