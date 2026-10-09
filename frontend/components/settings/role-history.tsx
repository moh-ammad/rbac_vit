"use client";

import { ArrowRightLeft, CirclePlus, KeyRound, Pencil, Power, PowerOff, Trash2, UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import { formatDate, timeAgo } from "@/lib/format";
import type { RoleEvent } from "@/types";

const META: Record<string, { icon: LucideIcon; tone: string; verb: string }> = {
  CREATED: { icon: CirclePlus, tone: "bg-[#e3f0e6] text-[#2f6b45]", verb: "created role" },
  UPDATED: { icon: Pencil, tone: "bg-[#e5eef9] text-[#2f5d91]", verb: "edited details of" },
  PERMISSIONS_CHANGED: { icon: KeyRound, tone: "bg-[#eee8f8] text-[#5b3f91]", verb: "changed permissions of" },
  SCOPE_CHANGED: { icon: ArrowRightLeft, tone: "bg-[#fbf0d9] text-[#8a5a12]", verb: "changed class access of" },
  ACTIVATED: { icon: Power, tone: "bg-[#e3f0e6] text-[#2f6b45]", verb: "turned on" },
  DEACTIVATED: { icon: PowerOff, tone: "bg-[#eef1ee] text-[#55635a]", verb: "turned off" },
  DELETED: { icon: Trash2, tone: "bg-[#fbe5e3] text-[#a33a2f]", verb: "deleted role" },
  ASSIGNED: { icon: UserPlus, tone: "bg-[#e3f0e6] text-[#2f6b45]", verb: "assigned" },
  UNASSIGNED: { icon: UserMinus, tone: "bg-[#eef1ee] text-[#55635a]", verb: "removed" },
};

function detailText(event: RoleEvent) {
  const d = event.details ?? {};
  if (event.action === "PERMISSIONS_CHANGED") {
    const added = (d.added as string[] | undefined) ?? [];
    const removed = (d.removed as string[] | undefined) ?? [];
    return [added.length ? `+ ${added.join(", ")}` : "", removed.length ? `− ${removed.join(", ")}` : ""].filter(Boolean).join("   ");
  }
  if (event.action === "SCOPE_CHANGED") return d.allClasses ? "All classes and subjects" : ((d.classes as string[] | undefined) ?? []).join(" · ") || "No classes";
  if (event.action === "CREATED") return `${String(d.audience ?? "").toLowerCase()} · ${((d.permissions as string[] | undefined) ?? []).length} permissions · ${d.allClasses ? "all classes" : `${d.classes ?? 0} classes`}`;
  if (event.action === "UPDATED") {
    const from = d.from as { name?: string; audience?: string } | undefined;
    const to = d.to as { name?: string; audience?: string } | undefined;
    return from && to ? `${from.name} (${from.audience?.toLowerCase()}) → ${to.name} (${to.audience?.toLowerCase()})` : "";
  }
  if (d.reason) return String(d.reason);
  return "";
}

export function RoleHistory({ events, compact = false }: { events: RoleEvent[]; compact?: boolean }) {
  if (!events.length) return <p className="py-6 text-center text-sm text-[#7d8981]">No activity yet.</p>;
  return (
    <ol className="space-y-1">
      {events.map((event) => {
        const meta = META[event.action] ?? META.UPDATED!;
        const Icon = meta.icon;
        const who = event.actor?.name ?? "System";
        const userBit = event.targetUser ? ` ${event.targetUser.name} ${event.action === "ASSIGNED" ? "to" : "from"}` : "";
        const extra = detailText(event);
        return (
          <li key={event.id} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-[#fafbfa]">
            <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon size={14} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#26332b]"><span className="font-semibold">{who}</span> {meta.verb}{userBit} <span className="font-semibold">{event.roleName}</span></p>
              {extra && !compact && <p className="mt-0.5 break-words text-xs text-[#6b786f]">{extra}</p>}
            </div>
            <time title={formatDate(event.createdAt, true)} className="shrink-0 text-xs text-[#9aa59d]">{timeAgo(event.createdAt)}</time>
          </li>
        );
      })}
    </ol>
  );
}
