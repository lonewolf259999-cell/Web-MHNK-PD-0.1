'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind, ms?: number) => void>(
  () => {}
);

export function useToast() {
  return useContext(ToastContext);
}

const STYLES: Record<ToastKind, string> = {
  success: 'border-success/40 bg-success/15 text-success',
  error: 'border-danger/40 bg-danger/15 text-danger',
  info: 'border-accent/40 bg-accent/15 text-accent',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'info', ms = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), ms);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[10001] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto max-w-md rounded-md border px-4 py-2.5 text-sm font-medium backdrop-blur-sm ${STYLES[toast.kind]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
