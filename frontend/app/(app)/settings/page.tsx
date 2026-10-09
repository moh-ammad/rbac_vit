"use client";

import { Crown, History, Plus, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RoleEditor } from "@/components/settings/role-editor";
import { RoleHistory } from "@/components/settings/role-history";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Loading, PageHeader, Tabs } from "@/components/ui/display";
import { AUDIENCE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { PermissionGroup, Role, RoleEvent, ScopeTreeClass } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"roles" | "activity">("roles");
  const roles = useApi<{ roles: Role[] }>("/roles");
  const perms = useApi<{ groups: PermissionGroup[] }>("/permissions");
  const tree = useApi<{ classes: ScopeTreeClass[] }>("/roles/scope-tree");
  const events = useApi<{ events: RoleEvent[] }>(tab === "activity" ? "/roles/events" : null);
  const selected = params.get("role") ?? (roles.data?.roles.find((r) => !r.isSuperAdmin)?.id ?? roles.data?.roles[0]?.id ?? "new");
  const select = (id: string) => router.replace(`/settings?role=${id}`, { scroll: false });

  const list = roles.data?.roles ?? [];
  const counts = { STAFF: 0, TEACHER: 0, STUDENT: 0, ...Object.fromEntries(["STAFF", "TEACHER", "STUDENT"].map((a) => [a, list.filter((r) => r.audience === a && !r.isSuperAdmin).length])) };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Create roles, decide which pages they open and which classes & subjects they reach. Every change is saved to the database and tracked."
        action={<><Tabs value={tab} onChange={setTab} items={[{ value: "roles", label: "Roles" }, { value: "activity", label: "Activity log" }]} /><Button icon={Plus} onClick={() => { setTab("roles"); select("new"); }}>New role</Button></>}
      />

      {tab === "activity" ? (
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm text-[#66736c]"><History size={16} />Every role creation, edit, permission change, class-access change and assignment — newest first.</div>
          {events.loading ? <Loading /> : <RoleHistory events={events.data?.events ?? []} />}
        </Card>
      ) : roles.loading || perms.loading || tree.loading ? (
        <Loading label="Loading roles" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3 lg:sticky lg:top-24">
            <Card padded={false}>
              <div className="border-b border-[#edf1ee] px-4 py-3">
                <p className="text-sm font-semibold text-[#17221d]">{list.length} roles</p>
                <p className="text-xs text-[#7d8981]">{counts.STAFF} staff · {counts.TEACHER} teacher · {counts.STUDENT} student</p>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto p-2">
                {list.map((role) => (
                  <li key={role.id}>
                    <button onClick={() => select(role.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${selected === role.id ? "bg-[#17221d] text-white" : "hover:bg-[#f3f6f3]"}`}>
                      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${selected === role.id ? "bg-white/15" : "bg-[#edf2ed] text-[#4a6654]"}`}>{role.isSuperAdmin ? <Crown size={15} /> : <ShieldCheck size={15} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{role.name}</span>
                        <span className={`block truncate text-xs ${selected === role.id ? "text-white/70" : "text-[#7d8981]"}`}>{role.isSuperAdmin ? "Full access" : `${AUDIENCE_LABEL[role.audience]} · ${role.allClasses ? "all classes" : `${role.scope.length} class${role.scope.length === 1 ? "" : "es"}`}`}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className={`text-xs ${selected === role.id ? "text-white/80" : "text-[#7d8981]"}`}>{role.members}</span>
                        {!role.isActive && <Badge tone="amber">off</Badge>}
                      </span>
                    </button>
                  </li>
                ))}
                {selected === "new" && <li><div className="mt-1 flex items-center gap-3 rounded-lg border border-dashed border-[#9fbaa2] bg-[#f2f8f3] px-3 py-2.5 text-sm font-semibold text-[#2f6b45]"><Plus size={15} />New role</div></li>}
              </ul>
            </Card>
            {list.length <= 1 && <EmptyState icon={ShieldCheck} title="Only the Super Admin exists" description="Create your first role — e.g. Principal, Science Teacher or Class 2 Student." />}
          </aside>

          <RoleEditor
            key={selected}
            roleId={selected}
            groups={perms.data?.groups ?? []}
            tree={tree.data?.classes ?? []}
            onSaved={(role) => { roles.reload(); select(role.id); }}
            onDeleted={() => { roles.reload(); router.replace("/settings"); }}
          />
        </div>
      )}
    </>
  );
}
