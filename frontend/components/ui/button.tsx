"use client";

import { LoaderCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const styles: Record<Variant, string> = {
  primary: "bg-[#17221d] text-white hover:bg-[#2c4235] disabled:bg-[#17221d]/50",
  secondary: "border border-[#d6dfd8] bg-white text-[#17221d] hover:bg-[#f1f4f1]",
  ghost: "text-[#55635a] hover:bg-[#eef2ee] hover:text-[#17221d]",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};
const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2" };

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: LucideIcon; loading?: boolean };

export function Button({ variant = "primary", size = "md", icon: Icon, loading, className = "", children, disabled, ...rest }: Props) {
  return (
    <button {...rest} disabled={disabled || loading} className={`inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${sizes[size]} ${className}`}>
      {loading ? <LoaderCircle size={size === "sm" ? 14 : 16} className="animate-spin" /> : Icon ? <Icon size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", icon: Icon, className = "", children }: { href: string; variant?: Variant; size?: "sm" | "md"; icon?: LucideIcon; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition ${styles[variant]} ${sizes[size]} ${className}`}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} />}
      {children}
    </Link>
  );
}

/** Two-step delete: first click arms it, second click confirms. No browser dialogs. */
export function ConfirmButton({ onConfirm, label = "Delete", confirmLabel = "Click again to confirm", icon, size = "sm", variant = "danger" }: { onConfirm: () => Promise<void> | void; label?: string; confirmLabel?: string; icon?: LucideIcon; size?: "sm" | "md"; variant?: Variant }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      type="button" size={size} variant={armed ? "danger" : variant} icon={icon} loading={busy}
      className={armed ? "!bg-red-600 !text-white" : ""}
      onClick={async (event) => {
        event.stopPropagation();
        if (!armed) return setArmed(true);
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
