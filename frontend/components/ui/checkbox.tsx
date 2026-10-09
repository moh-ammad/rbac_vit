"use client";

import { Check, Minus } from "lucide-react";

/** Checkbox with a third "partly selected" state, used for nested trees. */
export function Checkbox({ checked, indeterminate = false, onChange, label, disabled, id }: { checked: boolean; indeterminate?: boolean; onChange: (next: boolean) => void; label?: React.ReactNode; disabled?: boolean; id?: string }) {
  const on = checked || indeterminate;
  return (
    <button
      id={id} type="button" role="checkbox" aria-checked={indeterminate ? "mixed" : checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition ${on ? "border-[#2f6b45] bg-[#2f6b45] text-white" : "border-[#b9c6bc] bg-white group-hover:border-[#6c8872]"}`}>
        {indeterminate ? <Minus size={12} strokeWidth={3} /> : checked ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      {label && <span className="text-sm text-[#26332b]">{label}</span>}
    </button>
  );
}
