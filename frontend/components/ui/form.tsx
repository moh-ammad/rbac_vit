"use client";

import { Search, X } from "lucide-react";

const control = "w-full rounded-lg border border-[#d9e2db] bg-white px-3 text-sm text-[#17221d] outline-none placeholder:text-[#9aa59d] focus:border-[#6c8872] focus:ring-2 focus:ring-[#dce9dd] disabled:bg-[#f4f6f4] disabled:text-[#8a958e]";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-[#34433a]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-[#7d8981]">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} h-10 ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} min-h-24 py-2.5 leading-6 ${props.className ?? ""}`} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} h-10 pr-8 ${props.className ?? ""}`}>{children}</select>;
}

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b968e]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={`${control} h-10 pl-9 pr-9`} />
      {value && <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#8b968e] hover:bg-[#eef2ee]"><X size={14} /></button>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${checked ? "bg-[#2f6b45]" : "bg-[#cfd8d1]"}`}>
        <span className={`size-4 rounded-full bg-white shadow transition ${checked ? "translate-x-4" : ""}`} />
      </span>
      <span><span className="block text-sm font-medium text-[#17221d]">{label}</span>{description && <span className="block text-xs leading-5 text-[#7d8981]">{description}</span>}</span>
    </button>
  );
}
