"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { AlertTriangleIcon, CheckCircleIcon, XIcon } from "./Icons";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => {
          const style =
            toast.tone === "success"
              ? "bg-[#1F211E] text-[#F6FAF6] border-[#246326]"
              : toast.tone === "error"
                ? "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]"
                : "bg-white text-[#1A1E1A] border-[#D4E4D5]";
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg text-sm font-medium ${style}`}
            >
              {toast.tone === "error" ? (
                <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-[#347F2F]" />
              )}
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Tutup notifikasi"
                className="p-1 rounded-lg hover:bg-black/10 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
