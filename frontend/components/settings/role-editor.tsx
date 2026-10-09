"use client";

import { Crown, Save, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PermissionMatrix } from "@/components/settings/permission-matrix";
import { RoleHistory } from "@/components/settings/role-history";
import { ScopeTree, scopeSummary } from "@/components/settings/scope-tree";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge, Card, Loading, SectionTitle } from "@/components/ui/display";
import { Field, Input, Toggle } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AUDIENCE_HINT, AUDIENCE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Audience, PermissionGroup, Role, RoleEvent, ScopeEntry, ScopeTreeClass } from "@/types";

type Draft = { name: string; description: string; audience: Audience; isActive: boolean; permissions: string[]; allClasses: boolean; scope: ScopeEntry[] };

const emptyDraft: Draft = { name: "", description: "", audience: "TEACHER", isActive: true, permissions: [], allClasses: false, scope: [] };

function toDraft(role: Role): Draft {
  return {
    name: role.name, description: role.description ?? "", audience: role.audience, isActive: role.isActive, permissions: [...role.permissions].sort(), allClasses: role.allClasses,
    scope: role.scope.map((s) => ({ classId: s.classId, allSubjects: s.allSubjects, classSubjectIds: [...s.classSubjectIds].sort() })),
  };
}

const normalize = (d: Draft) => JSON.stringify({ ...d, permissions: [...d.permissions].sort(), scope: [...d.scope].sort((a, b) => a.classId.localeCompare(b.classId)).map((s) => ({ ...s, classSubjectIds: [...s.classSubjectIds].sort() })) });

export function RoleEditor({ roleId, groups, tree, onSaved, onDeleted }: { roleId: string | "new"; groups: PermissionGroup[]; tree: ScopeTreeClass[]; onSaved: (role: Role) => void; onDeleted: () => void }) {
  const { me } = useAuth();
  const isNew = roleId === "new";
  const detail = useApi<{ role: Role }>(isNew ? null : `/roles/${roleId}`);
  const history = useApi<{ events: RoleEvent[] }>(isNew ? null : `/roles/events?roleId=${roleId}`);
  const [edited, setEdited] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const role = isNew ? null : detail.data?.role;
  // Until the user changes something, the form shows the saved role.
  const saved = useMemo(() => (isNew ? emptyDraft : role ? toDraft(role) : emptyDraft), [isNew, role]);
  const draft = edited ?? saved;

  const dirty = useMemo(() => (isNew ? draft.name.trim().length > 0 : role ? normalize(draft) !== normalize(toDraft(role)) : false), [draft, role, isNew]);
  const grantable = (key: string) => Boolean(me?.isSuperAdmin || me?.permissions.includes(key));
  const ownRole = !me?.isSuperAdmin && me?.role?.id === roleId;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setEdited({ ...draft, [key]: value });

  if (!isNew && (detail.loading || !role)) return <Card><Loading label="Loading role" /></Card>;

  if (role?.isSuperAdmin) {
    return (
      <Card className="space-y-4">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#17221d] text-white"><Crown size={20} /></span><div><h2 className="text-xl font-semibold text-[#17221d]">{role.name}</h2><p className="text-sm text-[#66736c]">Created by the seed script. Has every permission on every class. Locked so nobody can lock themselves out.</p></div></div>
        <Members role={role} />
        <SectionTitle>History</SectionTitle>
        <RoleHistory events={history.data?.events ?? []} />
      </Card>
    );
  }

  async function save() {
    if (draft.name.trim().length < 2) return toast.error("Give the role a name");
    setSaving(true);
    try {
      const body = { ...draft, description: draft.description || null };
      const result = await api<{ role: Role }>(isNew ? "/roles" : `/roles/${roleId}`, { method: isNew ? "POST" : "PUT", body });
      toast.success(isNew ? `Role “${result.role.name}” created` : "Role saved");
      onSaved(result.role);
      if (!isNew) { detail.reload(); history.reload(); }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#17221d]">{isNew ? "New role" : role?.name}</h2>
            <p className="mt-1 text-sm text-[#66736c]">{isNew ? "Name it anything — Principal, Science Teacher, Class 5 Student…" : `${role?.members ?? 0} member${role?.members === 1 ? "" : "s"} · ${draft.permissions.length} permissions · ${draft.allClasses ? "all classes" : scopeSummary(draft.scope, tree)}`}</p>
          </div>
          {ownRole && <Badge tone="amber">This is your own role — read only</Badge>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Role name"><Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Science Teacher" disabled={ownRole} /></Field>
          <Field label="Description"><Input value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional" disabled={ownRole} /></Field>
        </div>
        <div className="mt-5">
          <span className="mb-1.5 block text-sm font-medium text-[#34433a]">Who holds this role?</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["STAFF", "TEACHER", "STUDENT"] as Audience[]).map((a) => (
              <button key={a} type="button" disabled={ownRole} onClick={() => set("audience", a)} className={`rounded-lg border p-3 text-left transition ${draft.audience === a ? "border-[#2f6b45] bg-[#f2f8f3] ring-1 ring-[#2f6b45]" : "border-[#e0e7e1] hover:border-[#b9c6bc]"}`}>
                <span className="block text-sm font-semibold text-[#17221d]">{AUDIENCE_LABEL[a]}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[#6b786f]">{AUDIENCE_HINT[a]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 max-w-md"><Toggle checked={draft.isActive} onChange={(v) => !ownRole && set("isActive", v)} label="Role is active" description="Turn off to pause everyone with this role without deleting it." /></div>
      </Card>

      <Card>
        <SectionTitle>Page access</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-[#66736c]">Which pages this role sees and what it can do there. “Manage” means add, edit and delete.</p>
        <PermissionMatrix groups={groups} value={draft.permissions} onChange={(v) => set("permissions", v)} grantable={grantable} disabled={ownRole} />
      </Card>

      <Card>
        <SectionTitle>Class & subject access</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-[#66736c]">Everything this role sees — classes, subjects, resources, videos, papers, results — is limited to what you tick here.</p>
        <div className="mb-4 max-w-lg">
          <Toggle checked={draft.allClasses} onChange={(v) => !ownRole && (me?.unrestricted ?? false) && set("allClasses", v)} label="All classes and subjects" description={me?.unrestricted ? "For roles like Principal. Includes classes created later." : "Only users with access to all classes can grant this."} />
        </div>
        {!draft.allClasses && <ScopeTree tree={tree} value={draft.scope} onChange={(v) => set("scope", v)} disabled={ownRole} />}
      </Card>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e7e1] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="text-sm text-[#66736c]">{dirty ? "You have unsaved changes" : isNew ? "Fill in the role and save" : "All changes saved"}</span>
        <div className="flex gap-2">
          {!isNew && !ownRole && <ConfirmButton icon={Trash2} label="Delete role" confirmLabel={role?.members ? `Delete & unassign ${role.members}?` : "Confirm delete"} onConfirm={async () => { try { await api(`/roles/${roleId}`, { method: "DELETE" }); toast.success("Role deleted"); onDeleted(); } catch (e) { toast.error(errorMessage(e)); } }} />}
          <Button icon={Save} loading={saving} disabled={!dirty || ownRole} onClick={save}>{isNew ? "Create role" : "Save changes"}</Button>
        </div>
      </div>

      {!isNew && role && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><Members role={role} /></Card>
          <Card><SectionTitle>History of this role</SectionTitle><RoleHistory events={history.data?.events ?? []} /></Card>
        </div>
      )}
    </div>
  );
}

function Members({ role }: { role: Role }) {
  const users = role.users ?? [];
  return (
    <div>
      <SectionTitle action={<Link href={`/users?roleId=${role.id}`} className="text-xs font-semibold text-[#2f6b45] hover:underline">Manage in Users</Link>}>Members ({users.length})</SectionTitle>
      {users.length === 0 ? (
        <p className="flex items-center gap-2 py-4 text-sm text-[#7d8981]"><Users size={16} />Nobody has this role yet. Assign it from the Users page.</p>
      ) : (
        <ul className="divide-y divide-[#f0f3f0]">
          {users.slice(0, 12).map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0"><span className="block truncate text-sm font-medium text-[#17221d]">{u.name}</span><span className="block truncate text-xs text-[#7d8981]">{u.email}</span></span>{u.status !== "ACTIVE" && <Badge tone="amber">{u.status.toLowerCase()}</Badge>}</li>
          ))}
          {users.length > 12 && <li className="py-2 text-xs text-[#7d8981]">and {users.length - 12} more…</li>}
        </ul>
      )}
    </div>
  );
}
