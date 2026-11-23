import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previous = document.activeElement;
    const node = document.querySelector('[role="dialog"]');
    const first = node?.querySelector('input, button, a');
    first?.focus();
    const trap = e => {
      if (e.key !== 'Tab' || !node) return;
      const all = [...node.querySelectorAll('button, input, select, a, textarea')].filter(x => !x.disabled);
      const a = all[0];
      const b = all[all.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b?.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}
