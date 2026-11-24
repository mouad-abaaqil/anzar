import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Toasts: polite live region, 5 s, paused while hovered or focused, always closable.
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());
  const dismiss = useCallback(id => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems(list => list.filter(t => t.id !== id));
  }, []);
  const arm = useCallback((id, ms = 5000) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);
  const push = useCallback((message, { tone = 'info' } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems(list => [...list.slice(-2), { id, message, tone }]);
    arm(id);
    return id;
  }, [arm]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="az-toasts" role="status" aria-live="polite">
        {items.map(t => (
          <div
            key={t.id}
            className={`az-toast az-toast--${t.tone}`}
            onPointerEnter={() => clearTimeout(timers.current.get(t.id))}
            onPointerLeave={() => arm(t.id, 2500)}
            onFocus={() => clearTimeout(timers.current.get(t.id))}
            onBlur={() => arm(t.id, 2500)}
          >
            <span className="az-toast__msg">{t.message}</span>
            <button type="button" className="az-toast__close" aria-label="Fermer le message" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
