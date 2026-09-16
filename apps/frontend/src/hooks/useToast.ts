import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "error";

export type Toast = {
  tone: ToastTone;
  text: string;
};

const DEFAULT_DURATION_MS = 2200;

/**
 * Tiny transient notice, the same behaviour the sample page implements inline.
 * Render `toast` wherever the page wants it (see `.page-toast` in index.css).
 */
export function useToast(durationMs = DEFAULT_DURATION_MS) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<number | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (tone: ToastTone, text: string) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setToast({ tone, text });
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast, dismissToast };
}

export default useToast;
