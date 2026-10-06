import { useCallback, createContext, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message, kind = 'success', timeout = 4200) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, kind }]);
    if (timeout) setTimeout(() => dismiss(id), timeout);
  }, [dismiss]);

  const success = useCallback((m) => push(m, 'success'), [push]);
  const error = useCallback((m) => push(m, 'error', 6000), [push]);
  const info = useCallback((m) => push(m, 'info'), [push]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-pop ring-1 animate-fadeUp ${
              t.kind === 'error'
                ? 'bg-rose-50 text-rose-800 ring-rose-200'
                : t.kind === 'info'
                ? 'bg-sky-50 text-sky-800 ring-sky-200'
                : 'bg-emerald-50 text-emerald-800 ring-emerald-200'
            }`}
          >
            {t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> :
             t.kind === 'info' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> :
             <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <p className="text-sm font-medium leading-5">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="ml-auto rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
