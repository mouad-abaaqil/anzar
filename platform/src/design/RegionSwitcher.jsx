import { useEffect, useId, useRef, useState } from 'react';

// Region switcher: current region (SRM icon + name), opens a grid of the 12 regions.
// regions: the "regions" array of public/data/regions.json (id, name, icon, operator.acronym).
// Icons were cropped on white, so they always sit on a light tile.
export default function RegionSwitcher({ regions = [], value, onChange, label = 'Région' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const items = useRef([]);
  const current = regions.find(r => r.id === value);
  const popId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const i = Math.max(0, regions.findIndex(r => r.id === value));
    items.current[i]?.focus();
    const onDown = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const pick = id => { onChange?.(id); close(); };
  const onKey = (e, i) => {
    const cols = Math.round(items.current[0]?.parentElement?.offsetWidth / (items.current[0]?.offsetWidth || 1)) || 1;
    const n = regions.length;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: n - 1 }[e.key];
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (next === undefined) return;
    e.preventDefault();
    items.current[Math.min(n - 1, Math.max(0, next))]?.focus();
  };

  return (
    <div className="az-region" ref={root}>
      <button ref={trigger} type="button" className="az-region__trigger" aria-expanded={open} aria-controls={popId} onClick={() => setOpen(o => !o)}>
        <span className="az-region__tile">{current?.icon && <img src={current.icon} alt="" />}</span>
        <span className="az-region__text">
          <span className="az-region__label">{label}</span>
          <span className="az-region__name">{current?.name || 'Choisir'}</span>
        </span>
        <span className="az-region__chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={popId} className="az-region__pop" role="group" aria-label="Choisir une région">
          <ul className="az-region__grid">
            {regions.map((r, i) => (
              <li key={r.id}>
                <button
                  ref={el => { items.current[i] = el; }}
                  type="button"
                  className="az-region__item"
                  aria-current={r.id === value ? 'true' : undefined}
                  onClick={() => pick(r.id)}
                  onKeyDown={e => onKey(e, i)}
                >
                  <span className="az-region__tile">{r.icon && <img src={r.icon} alt="" loading="lazy" />}</span>
                  <span className="az-region__item-text">
                    <span className="az-region__item-name">{r.name}</span>
                    {r.operator?.acronym && <span className="az-region__item-op">{r.operator.acronym}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
