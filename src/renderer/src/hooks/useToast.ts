import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error';
export type ToastAction = { label: string; onClick: () => void };
export type ToastState = { message: string; type: ToastType; action?: ToastAction };

export function useToast(): {
  toast: ToastState | null;
  showToast: (message: string, type: ToastType, action?: ToastAction) => void;
  dismissToast: () => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, type: ToastType, action?: ToastAction) => {
    setToast({ message, type, action });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), action ? 5000 : 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return { toast, showToast, dismissToast };
}
