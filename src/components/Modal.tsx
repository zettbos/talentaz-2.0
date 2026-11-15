"use client";

import React, { useEffect } from "react";
import { XIcon } from "./Icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  maxWidthClass = "max-w-lg",
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1A1E1A]/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white border border-[#D4E4D5] rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] flex flex-col`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#D4E4D5]">
          <h2 className="text-base sm:text-lg font-semibold text-[#1A1E1A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Tutup ${title}`}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#465147] hover:bg-[#F3F8F3] hover:text-[#1A1E1A] transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
