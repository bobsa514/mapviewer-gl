/**
 * Toast notification system. Emits dark-pill toasts center-bottom using the
 * design system's `.toasts` + `.toast` classes. Types (error/success/info/warning)
 * now surface through a colored accent dot rather than a full colored background.
 */

import { useState, useCallback, useRef } from 'react';
import { InfoIcon } from './icons';

export interface ToastMessage {
  id: number;
  type: 'error' | 'success' | 'info' | 'warning';
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}

const dotColor: Record<ToastMessage['type'], string> = {
  error: 'oklch(0.58 0.18 28)',
  success: 'oklch(0.65 0.14 145)',
  info: 'var(--accent)',
  warning: 'oklch(0.75 0.15 75)',
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          role="alert"
          onClick={() => onRemove(toast.id)}
          title="Click to dismiss"
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: dotColor[toast.type],
              flexShrink: 0,
            }}
          />
          {toast.type === 'info' && <InfoIcon size={13} />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
