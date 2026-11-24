import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// Provenance in one glyph: ● sourcé, ◐ dérivé, ○ hypothèse. Tap / click / Enter opens the detail;
// hover opens it only on devices that can hover. Escape or a click outside closes and returns focus.
export const PROVENANCE = {
  sourced: { glyph: '●', label: 'Sourcé', hint: 'chiffre publié par une source datée' },
  derived: { glyph: '◐', label: 'Dérivé', hint: 'calculé à partir de chiffres sourcés' },
  hypothese: { glyph: '○', label: 'Hypothèse', hint: 'valeur choisie, non mesurée' },
};

export default function ProvenanceChip({ status = 'sourced', source, date, url, note, showLabel = false }) {
  const p = PROVENANCE[status] || PROVENANCE.hypothese;
  const [open, setOpen] = useState(false);
  const pinned = useRef(false); // opened by click / tap / Enter: hover-leave no longer closes it
  const root = useRef(null);
  const trigger = useRef(null);
  const pop = useRef(null);
  const hoverTimer = useRef(0);
  const id = useId();
  const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') { pinned.current = false; setOpen(false); trigger.current?.focus(); } };
    const onDown = e => { if (!root.current?.contains(e.target)) { pinned.current = false; setOpen(false); } };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  // Keep the popover inside the viewport (8 px margin).
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    el.style.setProperty('--az-pop-shift', '0px');
    const r = el.getBoundingClientRect();
    const shift = r.left < 8 ? 8 - r.left : r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : 0;
    el.style.setProperty('--az-pop-shift', `${shift}px`);
  }, [open]);

  const hover = next => {
    if (!canHover || pinned.current) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(next), next ? 150 : 250);
  };

  return (
    <span className="az-prov" ref={root} onPointerEnter={() => hover(true)} onPointerLeave={() => hover(false)}>
      <button
        ref={trigger}
        type="button"
        className={`az-prov__btn az-prov--${status}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          clearTimeout(hoverTimer.current);
          // Hover may already have opened it: the first click pins it; a click on a pinned chip closes it.
          if (pinned.current) { pinned.current = false; setOpen(false); } else { pinned.current = true; setOpen(true); }
        }}
      >
        {/* Le glyphe est dessiné en CSS (data-glyph) : le seul texte du bouton est son nom accessible, identique au texte lu. */}
        <span aria-hidden="true" className="az-prov__glyph" data-glyph={p.glyph} />
        {showLabel ? (
          <>
            <span className="az-sr">Provenance : </span>
            <span className="az-prov__label">{p.label}</span>
          </>
        ) : <span className="az-sr">Provenance : {p.label}</span>}
      </button>
      <span ref={pop} id={id} role="note" className="az-prov__pop" hidden={!open}>
        <span className="az-prov__pop-title"><span aria-hidden="true">{p.glyph}</span> {p.label}</span>
        <span className="az-prov__pop-hint">{p.hint}</span>
        {source && <span className="az-prov__pop-row">{url ? <a href={url} target="_blank" rel="noreferrer">{source}</a> : source}</span>}
        {date && <span className="az-prov__pop-row az-prov__pop-date">{date}</span>}
        {note && <span className="az-prov__pop-row">{note}</span>}
      </span>
    </span>
  );
}
