import { useState, useCallback, useRef } from 'react';

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
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}

const typeStyles: Record<ToastMessage['type'], string> = {
  error: 'bg-red-600 text-white',
  success: 'bg-green-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-500 text-white',
};

const typeIcons: Record<ToastMessage['type'], string> = {
  error: '\u2716',
  success: '\u2714',
  info: '\u2139',
  warning: '\u26A0',
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm animate-[slideIn_0.3s_ease-out] ${typeStyles[toast.type]}`}
          role="alert"
        >
          <span className="flex-shrink-0 mt-0.5">{typeIcons[toast.type]}</span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="flex-shrink-0 opacity-70 hover:opacity-100 ml-2"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
