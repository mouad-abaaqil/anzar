import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const pop = useRef(null);
  const [pos, setPos] = useState(null);

  // La liste est rendue dans <body> (portail) et positionnée dans la fenêtre : jamais coupée par un
  // parent (panneau, carte, transform) ni hors du cadre. Alignée sur le bouton, retournée vers le haut si l'espace manque.
  const place = () => {
    const t = trigger.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const m = 12;
    const width = Math.min(720, vw - 2 * m);
    let left = r.left + r.width / 2 > vw / 2 ? r.right - width : r.left;
    left = Math.max(m, Math.min(left, vw - width - m));
    const below = vh - r.bottom - m - 8;
    const above = r.top - m - 8;
    const flip = below < 260 && above > below;
    const room = Math.max(160, flip ? above : below);
    setPos({ left, width, maxHeight: Math.min(560, room), ...(flip ? { bottom: vh - r.top + 8 } : { top: r.bottom + 8 }) });
  };
  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    place();
    const again = () => place();
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    return () => { window.removeEventListener('resize', again); window.removeEventListener('scroll', again, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const i = Math.max(0, regions.findIndex(r => r.id === value));
    if (pos) items.current[i]?.focus({ preventScroll: true });
    const onDown = e => { if (!root.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, !!pos]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const pick = id => { onChange?.(id); close(); };
  const onKey = (e, i) => {
    const cols = Math.round(items.current[0]?.parentElement?.offsetWidth / (items.current[0]?.offsetWidth || 1)) || 1;
    const n = regions.length;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: n - 1 }[e.key];
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
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
      {open && pos && createPortal(
        <div id={popId} ref={pop} className="az-region__pop" role="group" aria-label="Choisir une région" style={pos}>
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
        </div>,
        document.body
      )}
    </div>
  );
}
