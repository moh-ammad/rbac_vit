"use client";

import { Clock3, Crown, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { RoleHistory } from "@/components/settings/role-history";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorNote, Loading, PageHeader, SectionTitle, type Tone } from "@/components/ui/display";
import { Field, Input, SearchInput, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AUDIENCE_LABEL, formatDate } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";
import type { AccountStatus, Role, RoleEvent, UserRow } from "@/types";

const STATUS_TONE: Record<AccountStatus, Tone> = { ACTIVE: "green", PENDING: "amber", SUSPENDED: "red" };

export default function UsersPage() {
  const params = useSearchParams();
  const { me, can } = useAuth();
  const manage = can("users.manage");
  const [q, setQ] = useState("");
  const [roleId, setRoleId] = useState(params.get("roleId") ?? "");
  const [status, setStatus] = useState("");
  const search = useDebounced(q);
  const users = useApi<{ users: UserRow[] }>(`/users${qs({ q: search, roleId, status })}`);
  const roles = useApi<{ roles: Role[] }>(manage ? "/roles" : null);
  const pending = useApi<{ users: UserRow[] }>(manage ? "/users?status=PENDING" : null);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const roleList = roles.data?.roles ?? [];
  const assignable = roleList.filter((r) => me?.isSuperAdmin || !r.isSuperAdmin);

  async function quickAssign(user: UserRow, newRoleId: string) {
    try {
      await api(`/users/${user.id}`, { method: "PUT", body: { roleId: newRoleId } });
      toast.success(`${user.name} can now sign in as ${roleList.find((r) => r.id === newRoleId)?.name}`);
      users.reload(); pending.reload();
    } catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <>
      <PageHeader title="Users" subtitle={manage ? "Create accounts, assign roles and manage access. A user's role decides everything they can see." : "People in your classes."} action={manage && <Button icon={UserPlus} onClick={() => setEditing("new")}>Add user</Button>} />

      {manage && (pending.data?.users.length ?? 0) > 0 && (
        <Card className="mb-6 border-[#f0d9a8] bg-[#fffaf0]">
          <SectionTitle><span className="flex items-center gap-2 text-[#8a5a12]"><Clock3 size={15} />Waiting for a role ({pending.data!.users.length})</span></SectionTitle>
          <ul className="divide-y divide-[#f3e6c8]">
            {pending.data!.users.map((u) => (
              <li key={u.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1"><span className="font-medium text-[#17221d]">{u.name}</span> <span className="text-sm text-[#7d8981]">{u.email} · signed up {formatDate(u.createdAt)}</span></span>
                <Select value="" onChange={(e) => e.target.value && quickAssign(u, e.target.value)} className="sm:w-64" aria-label={`Assign role to ${u.name}`}>
                  <option value="">Assign a role…</option>
                  {assignable.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.id}>{r.name} ({AUDIENCE_LABEL[r.audience]})</option>)}
                </Select>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or email…" className="sm:max-w-sm sm:flex-1" />
        {manage && <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="sm:w-56" aria-label="Role"><option value="">All roles</option><option value="none">No role</option>{roleList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44" aria-label="Status"><option value="">Any status</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspended</option></Select>
      </div>

      {users.error ? <ErrorNote message={users.error} /> : users.loading && !users.data ? <Loading /> : !users.data?.users.length ? <EmptyState icon={Users} title="No users found" /> : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-[#edf1ee] text-left text-xs uppercase tracking-wide text-[#7d8981]"><tr><th className="px-5 py-3 font-medium">Name</th><th className="px-5 py-3 font-medium">Role</th><th className="px-5 py-3 font-medium">Status</th><th className="hidden px-5 py-3 font-medium lg:table-cell">Joined</th>{manage && <th className="px-5 py-3" />}</tr></thead>
            <tbody className="divide-y divide-[#f0f3f0]">
              {users.data.users.map((u) => (
                <tr key={u.id} className="hover:bg-[#fafbfa]">
                  <td className="px-5 py-3"><div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#dce9dd] text-xs font-semibold text-[#365341]">{u.name.charAt(0)}</span><span className="min-w-0"><span className="block truncate font-medium text-[#17221d]">{u.name}{u.id === me?.id && <span className="text-[#8a958e]"> (you)</span>}</span><span className="block truncate text-xs text-[#7d8981]">{u.email}</span></span></div></td>
                  <td className="px-5 py-3">{u.role ? <span className="flex flex-wrap items-center gap-1.5">{u.role.isSuperAdmin && <Crown size={13} className="text-[#8a5a12]" />}<span className="font-medium text-[#26332b]">{u.role.name}</span><Badge>{AUDIENCE_LABEL[u.role.audience]}</Badge></span> : <span className="text-[#9aa59d]">No role</span>}</td>
                  <td className="px-5 py-3"><Badge tone={STATUS_TONE[u.status]}>{u.status.toLowerCase()}</Badge></td>
                  <td className="hidden px-5 py-3 text-[#7d8981] lg:table-cell">{formatDate(u.createdAt)}</td>
                  {manage && <td className="px-5 py-3 text-right">{(me?.isSuperAdmin || !u.role?.isSuperAdmin) && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(u)}>Edit</Button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && <UserForm user={editing === "new" ? null : editing} roles={assignable} self={editing !== "new" && editing.id === me?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); users.reload(); pending.reload(); }} />}
    </>
  );
}

function UserForm({ user, roles, self, onClose, onSaved }: { user: UserRow | null; roles: Role[]; self: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", password: "", roleId: user?.role?.id ?? "", status: user?.status ?? "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const history = useApi<{ events: RoleEvent[] }>(user ? `/users/${user.id}/history` : null);
  const selectedRole = roles.find((r) => r.id === form.roleId);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (user) {
        const body: Record<string, unknown> = { name: form.name, email: form.email };
        if (form.password) body.password = form.password;
        if (!self) { body.roleId = form.roleId || null; body.status = form.status; }
        await api(`/users/${user.id}`, { method: "PUT", body });
      } else {
        await api("/users", { method: "POST", body: { name: form.name, email: form.email, password: form.password, roleId: form.roleId || null } });
      }
      toast.success(user ? "User updated" : "User created");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} wide={Boolean(user)} title={user ? `Edit ${user.name}` : "Add user"}
      footer={<>{user && !self && <ConfirmButton size="md" icon={Trash2} label="Delete user" onConfirm={async () => { try { await api(`/users/${user.id}`, { method: "DELETE" }); toast.success("User deleted"); onSaved(); } catch (e) { toast.error(errorMessage(e)); } }} />}<span className="flex-1" /><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="user-form" type="submit" loading={saving} icon={user ? undefined : Plus}>{user ? "Save" : "Create user"}</Button></>}>
      <div className={user ? "grid gap-6 md:grid-cols-[1fr_260px]" : ""}>
        <form id="user-form" onSubmit={save} className="space-y-4">
          <Field label="Full name"><Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={user ? "New password" : "Password"} hint={user ? "Leave empty to keep the current password." : "Share it with the user; they can change it in their profile."}><Input type="text" required={!user} minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Role" hint={self ? "You can't change your own role." : selectedRole ? `${AUDIENCE_LABEL[selectedRole.audience]} · ${selectedRole.permissions.length} permissions · ${selectedRole.allClasses ? "all classes" : selectedRole.scope.map((s) => s.className).join(", ") || "no classes"}` : "Without a role the user waits on a 'pending' screen."}>
            <Select value={form.roleId} disabled={self} onChange={(e) => setForm({ ...form, roleId: e.target.value })}><option value="">No role (pending)</option>{roles.map((r) => <option key={r.id} value={r.id} disabled={!r.isActive}>{r.name}{!r.isActive ? " (off)" : ""}</option>)}</Select>
          </Field>
          {user && !self && <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AccountStatus })}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="PENDING">Pending</option></Select></Field>}
        </form>
        {user && <div><SectionTitle>Role history</SectionTitle>{history.loading ? <Loading /> : <RoleHistory events={(history.data?.events ?? []).map((e) => ({ ...e, details: null, roleId: null, targetUser: { name: user.name, email: user.email } }))} compact />}</div>}
      </div>
    </Modal>
  );
}
