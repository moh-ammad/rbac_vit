"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({ open, onClose, title, description, children, footer, wide = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17221d]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1ee] px-6 py-4">
          <div><h2 className="text-lg font-semibold text-[#17221d]">{title}</h2>{description && <p className="mt-0.5 text-sm text-[#6b786f]">{description}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#7d8981] hover:bg-[#f1f4f1]"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[#edf1ee] bg-[#fafbfa] px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}
