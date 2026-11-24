import { useId, useRef } from 'react';

// Tabs (WAI-ARIA): arrows / Home / End move and activate; only the active tab is in the Tab order.
export default function Tabs({ tabs, value, onChange, label, children }) {
  const base = useId();
  const refs = useRef([]);
  const idx = Math.max(0, tabs.findIndex(t => t.id === value));
  const move = (e, i) => {
    const n = tabs.length;
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className="az-tabs">
      <div role="tablist" aria-label={label} className="az-tabs__list">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={el => { refs.current[i] = el; }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={i === idx}
            aria-controls={`${base}-panel`}
            tabIndex={i === idx ? 0 : -1}
            className="az-tabs__tab"
            onClick={() => onChange(t.id)}
            onKeyDown={e => move(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${tabs[idx]?.id}`} className="az-tabs__panel" tabIndex={0}>
        {children}
      </div>
    </div>
  );
}
