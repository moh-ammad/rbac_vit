"use client";

import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { PermissionGroup } from "@/types";

/** One row per page, one checkbox per action. Grey + lock = you can't grant it. */
export function PermissionMatrix({ groups, value, onChange, grantable, disabled }: { groups: PermissionGroup[]; value: string[]; onChange: (next: string[]) => void; grantable: (key: string) => boolean; disabled?: boolean }) {
  const toggle = (key: string, on: boolean) => onChange(on ? [...new Set([...value, key])] : value.filter((k) => k !== key));

  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8e3]">
      {groups.map((group, index) => {
        const keys = group.permissions.map((p) => p.key).filter(grantable);
        const on = keys.filter((k) => value.includes(k));
        const all = keys.length > 0 && on.length === keys.length;
        return (
          <div key={group.page} className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[180px_1fr] ${index ? "border-t border-[#f0f3f0]" : ""}`}>
            <Checkbox
              checked={all} indeterminate={!all && on.length > 0} disabled={disabled || !keys.length}
              onChange={(next) => onChange(next ? [...new Set([...value, ...keys])] : value.filter((k) => !keys.includes(k)))}
              label={<span className="font-semibold text-[#17221d]">{group.page}</span>}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-2.5">
              {group.permissions.map((p) => {
                const ok = grantable(p.key);
                return (
                  <span key={p.key} title={ok ? p.description : "You don't have this permission, so you can't grant it"} className="inline-flex items-center gap-1">
                    <Checkbox checked={value.includes(p.key)} disabled={disabled || !ok} onChange={(next) => toggle(p.key, next)} label={p.label} />
                    {!ok && <Lock size={12} className="text-[#a0aaa3]" />}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
