"use client";

import { Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorNote, Loading, PageHeader } from "@/components/ui/display";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Instruction } from "@/types";

export default function InstructionsPage() {
  const { can } = useAuth();
  const manage = can("instructions.manage");
  const list = useApi<{ instructions: Instruction[] }>("/instructions");
  const [editing, setEditing] = useState<Instruction | "new" | null>(null);

  return (
    <>
      <PageHeader title="Instructions" subtitle="Notices, exam rules and guidelines — for the whole school or a single class." action={manage && <Button icon={Plus} onClick={() => setEditing("new")}>New instruction</Button>} />
      {list.error ? <ErrorNote message={list.error} /> : list.loading ? <Loading /> : !list.data?.instructions.length ? (
        <EmptyState icon={Megaphone} title="No instructions yet" description={manage ? "Post exam rules, timetables or notices for students and staff." : "Your school hasn't posted instructions yet."} action={manage && <Button icon={Plus} onClick={() => setEditing("new")}>New instruction</Button>} />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {list.data.instructions.map((item) => (
            <Card key={item.id} className={item.isPinned ? "border-[#cfe0d3] bg-[#fbfdfb]" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">{item.isPinned && <Badge tone="green"><Pin size={11} />Pinned</Badge>}<Badge tone={item.classGroup ? "blue" : "gray"}>{item.classGroup?.name ?? "Whole school"}</Badge></div>
                  <h2 className="mt-2 text-lg font-semibold text-[#17221d]">{item.title}</h2>
                </div>
                {manage && <div className="flex shrink-0 gap-1"><button onClick={() => setEditing(item)} aria-label="Edit" className="rounded-md p-2 text-[#66736c] hover:bg-[#f1f4f1]"><Pencil size={15} /></button><ConfirmButton icon={Trash2} label="" confirmLabel="Delete?" variant="ghost" onConfirm={async () => { try { await api(`/instructions/${item.id}`, { method: "DELETE" }); list.reload(); } catch (e) { toast.error(errorMessage(e)); } }} /></div>}
              </div>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#34433a]">{item.body.split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
              <p className="mt-4 text-xs text-[#8a958e]">{item.createdBy?.name ?? "Admin"} · {formatDate(item.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}
      {editing && <InstructionForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}

function InstructionForm({ item, onClose, onSaved }: { item: Instruction | null; onClose: () => void; onSaved: () => void }) {
  const { me } = useAuth();
  const classes = useApi<{ classes: { id: string; name: string }[] }>("/classes");
  const [form, setForm] = useState({ title: item?.title ?? "", body: item?.body ?? "", classId: item?.classGroup?.id ?? "", isPinned: item?.isPinned ?? false });
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(item ? `/instructions/${item.id}` : "/instructions", { method: item ? "PUT" : "POST", body: { ...form, classId: form.classId || null } });
      toast.success("Instruction saved");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} wide title={item ? "Edit instruction" : "New instruction"} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="instruction-form" type="submit" loading={saving}>Publish</Button></>}>
      <form id="instruction-form" onSubmit={save} className="space-y-4">
        <Field label="Title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Rules for the mid-term exam" /></Field>
        <Field label="Who should see it?">
          <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
            {me?.unrestricted ? <option value="">Whole school</option> : <option value="">Choose a class…</option>}
            {(classes.data?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Message"><Textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="min-h-48" /></Field>
        <Toggle checked={form.isPinned} onChange={(v) => setForm({ ...form, isPinned: v })} label="Pin to top" description="Pinned instructions also show on everyone's dashboard first." />
      </form>
    </Modal>
  );
}
