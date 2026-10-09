"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h1 className="text-[28px] font-semibold tracking-tight text-[#17221d]">{title}</h1>{subtitle && <p className="mt-1.5 text-sm text-[#66736c]">{subtitle}</p>}</div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "", padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return <div className={`rounded-xl border border-[#e2e8e3] bg-white ${padded ? "p-5" : ""} ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase tracking-[.08em] text-[#5d6c62]">{children}</h2>{action}</div>;
}

const tones = {
  gray: "bg-[#eef1ee] text-[#55635a]",
  green: "bg-[#e3f0e6] text-[#2f6b45]",
  amber: "bg-[#fbf0d9] text-[#8a5a12]",
  red: "bg-[#fbe5e3] text-[#a33a2f]",
  blue: "bg-[#e5eef9] text-[#2f5d91]",
  violet: "bg-[#eee8f8] text-[#5b3f91]",
  dark: "bg-[#17221d] text-white",
};
export type Tone = keyof typeof tones;

export function Badge({ children, tone = "gray", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export function StatCard({ icon: Icon, label, value, hint, tone = "green" }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: string; tone?: "green" | "blue" | "amber" | "violet" | "red" }) {
  const iconTone = { green: "bg-[#e3f0e6] text-[#2f6b45]", blue: "bg-[#e5eef9] text-[#2f5d91]", amber: "bg-[#fbf0d9] text-[#8a5a12]", violet: "bg-[#eee8f8] text-[#5b3f91]", red: "bg-[#fbe5e3] text-[#a33a2f]" }[tone];
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm text-[#66736c]">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-[#17221d]">{value}</p>{hint && <p className="mt-1 text-xs text-[#8a958e]">{hint}</p>}</div>
        <span className={`grid size-10 place-items-center rounded-lg ${iconTone}`}><Icon size={19} /></span>
      </div>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d3dcd5] bg-white px-6 py-14 text-center">
      <div className="mb-4 rounded-full bg-[#edf2ed] p-3.5 text-[#4a6654]"><Icon size={22} /></div>
      <h3 className="font-semibold text-[#17221d]">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-[#758079]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#6b786f]"><LoaderCircle size={18} className="animate-spin" />{label}…</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle size={16} />{message}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#e0e7e1] bg-white p-1">
      {items.map((item) => (
        <button key={item.value} type="button" onClick={() => onChange(item.value)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${value === item.value ? "bg-[#17221d] text-white" : "text-[#5d6c62] hover:bg-[#f1f4f1]"}`}>{item.label}</button>
      ))}
    </div>
  );
}

/** Horizontal bar 0–100 coloured by level. */
export function ScoreBar({ value, level }: { value: number; level?: "weak" | "average" | "strong" }) {
  const lvl = level ?? (value < 60 ? "weak" : value < 80 ? "average" : "strong");
  const color = { weak: "bg-[#d0574a]", average: "bg-[#d99a2b]", strong: "bg-[#3d8b5a]" }[lvl];
  return <div className="h-2 w-full overflow-hidden rounded-full bg-[#edf1ee]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>;
}

export function levelTone(level: "weak" | "average" | "strong"): Tone {
  return level === "weak" ? "red" : level === "average" ? "amber" : "green";
}
