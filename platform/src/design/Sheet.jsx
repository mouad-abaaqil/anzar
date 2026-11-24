import { useEffect, useId, useRef } from 'react';
import MicroLabel from './MicroLabel.jsx';

// Sheet: side panel on desktop, bottom sheet under 760 px. Native <dialog> (focus trap, Escape, top layer).
// The opener keeps focus management: the browser returns focus to it on close.
export default function Sheet({ open, onClose, label, title, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return undefined;
    const onCancel = e => { e.preventDefault(); onClose(); };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className="az-sheet"
      aria-labelledby={titleId}
      onClick={e => { if (e.target === ref.current) onClose(); }}
    >
      <div className="az-sheet__inner">
        <span className="az-sheet__grip" aria-hidden="true" />
        <header className="az-sheet__head">
          <div>
            {label && <MicroLabel>{label}</MicroLabel>}
            <h2 id={titleId} className="az-sheet__title">{title}</h2>
          </div>
          <button type="button" className="az-sheet__close" onClick={onClose}>
            <span className="az-sr">Fermer</span>
            <span aria-hidden="true" className="az-sheet__x" />
          </button>
        </header>
        <div className="az-sheet__body">{children}</div>
      </div>
    </dialog>
  );
}
