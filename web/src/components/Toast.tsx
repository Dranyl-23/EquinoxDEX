'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';
import { sendDesktopNotification } from '@/lib/notifications';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (title: string, type?: ToastType, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((title: string, type: ToastType = 'info', description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);

    // Trigger Native Web Browser Desktop Notification
    sendDesktopNotification(title, description);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-xl backdrop-blur-xl border shadow-2xl transition-all duration-300 ${
                isSuccess
                  ? 'bg-emerald-950/80 border-emerald-500/50 shadow-emerald-500/10 text-emerald-200'
                  : isError
                  ? 'bg-rose-950/80 border-rose-500/50 shadow-rose-500/10 text-rose-200'
                  : 'bg-panel/90 border-brand/50 shadow-brand/10 text-white'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <h4 className="font-bold text-xs uppercase tracking-wider">{t.title}</h4>
                {t.description && (
                  <p className="text-xs opacity-90 font-mono leading-relaxed">{t.description}</p>
                )}
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="text-muted hover:text-white text-xs font-semibold px-1 cursor-pointer"
              >
                Close
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
