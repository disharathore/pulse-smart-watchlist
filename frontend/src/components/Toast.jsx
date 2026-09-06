import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

const TYPE_STYLES = {
  success: 'border-good/40 bg-surface text-text',
  error: 'border-bad/40 bg-surface text-bad',
  info: 'border-border bg-surface text-text',
};

const TYPE_ICONS = {
  success: (
    <svg className="w-4 h-4 text-good flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 text-bad flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 7 7A7.008 7.008 0 0 0 8 1zm0 10a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm1-3.5a1 1 0 0 1-2 0V4.5a1 1 0 0 1 2 0z"/>
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 text-accent flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto border rounded-lg p-3 shadow-card flex items-center gap-2.5 text-small animate-fade-in ${TYPE_STYLES[t.type] || TYPE_STYLES.info}`}
          >
            {TYPE_ICONS[t.type] || TYPE_ICONS.info}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
