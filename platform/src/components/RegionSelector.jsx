import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { statusTone } from '../lib/regions.js';
import './RegionSelector.css';

export const NO_LOGO_TEXT = 'logo officiel non encore obtenu';

// Logo of the operator: the icon alone (icon) with fallback to the full official file (logo), otherwise a neutral chip. Never invented.
export function OperatorLogo({ region, size = 'md' }) {
  const op = region.operator;
  const src = region.icon || region.logo;
  if (src) {
    return (
      <span className={`operator-logo ${size}`}>
        <img src={src} alt={op.name} loading="lazy" decoding="async" />
      </span>
    );
  }
  return (
    <span className={`operator-logo-chip ${size}`}>
      <span>{op.acronym}</span>
      <span className="visually-hidden">{NO_LOGO_TEXT}</span>
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className="status-badge">
      <span className={`tone-dot ${statusTone(status)}`} aria-hidden="true" />
      {status}
    </span>
  );
}

export default function RegionSelector({ regions, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selectedIndex = Math.max(0, regions.findIndex(r => r.id === selectedId));
  const selected = regions[selectedIndex];
  const op = selected.operator;

  const openList = () => { setActive(selectedIndex); setOpen(true); };
  const close = returnFocus => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };
  const choose = index => {
    const region = regions[index];
    if (region) onSelect(region.id);
    close(true);
  };

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = e => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const onButtonKey = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    }
  };

  const onListKey = e => {
    const last = regions.length - 1;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(i => Math.min(last, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); setActive(i => Math.max(0, i - 1)); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(last); break;
      case 'Enter':
      case ' ': e.preventDefault(); choose(active); break;
      case 'Escape': e.preventDefault(); close(true); break;
      case 'Tab': close(false); break;
      default: break;
    }
  };

  return (
    <div className="region-selector" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="region-selector-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(true) : openList())}
        onKeyDown={onButtonKey}
      >
        <OperatorLogo region={selected} size="sm" />
        <span className="visually-hidden">{`Région : ${selected.name}, opérateur ${op.acronym}. Changer de région`}</span>
        <span className="region-selector-name" aria-hidden="true">{selected.name}</span>
        <span className="region-selector-acronym" aria-hidden="true">{op.acronym}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="region-popover">
          <div className="region-popover-operator">
            <div className="region-popover-logo">
              <OperatorLogo region={selected} size="md" />
              {!(selected.icon || selected.logo) && <span className="logo-note">{NO_LOGO_TEXT}</span>}
            </div>
            <div>
              <strong>{op.name}</strong>
              <StatusBadge status={op.status} />
              <span className="region-popover-meta">{op.date} · niveau de preuve : {op.evidence}</span>
            </div>
          </div>
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-label="Choisir une région"
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKey}
          >
            {regions.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={r.id === selectedId}
                className={`region-option ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="region-option-name">{r.name}</span>
                <span className="region-option-acronym">{r.operator.acronym}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
