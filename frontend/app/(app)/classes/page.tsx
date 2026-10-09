"use client";

import { BookMarked, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorNote, Loading, PageHeader, Tabs } from "@/components/ui/display";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";

type ClassRow = { id: string; name: string; grade: number | null; description: string | null; subjects: { classSubjectId: string; subjectId: string; name: string; topics: number }[] };
type SubjectRow = { id: string; name: string; description: string | null; classes: number };

export default function ClassesPage() {
  const { me, can } = useAuth();
  const manage = can("classes.manage");
  const full = Boolean(me?.unrestricted);
  const [tab, setTab] = useState<"classes" | "subjects">("classes");
  const classes = useApi<{ classes: ClassRow[] }>("/classes");
  const subjects = useApi<{ subjects: SubjectRow[] }>(tab === "subjects" ? "/subjects" : null);
  const [editing, setEditing] = useState<ClassRow | "new" | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectRow | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle={full ? "Every class in the school with the subjects taught in it." : "The classes and subjects your role gives you access to."}
        action={<>{manage && full && <Tabs value={tab} onChange={setTab} items={[{ value: "classes", label: "Classes" }, { value: "subjects", label: "Subjects" }]} />}{manage && full && (tab === "classes" ? <Button icon={Plus} onClick={() => setEditing("new")}>New class</Button> : <Button icon={Plus} onClick={() => setEditingSubject("new")}>New subject</Button>)}</>}
      />

      {tab === "subjects" ? (
        subjects.loading ? <Loading /> : !subjects.data?.subjects.length ? <EmptyState icon={BookMarked} title="No subjects yet" description="Create subjects once (Physics, English…) and add them to any class." /> : (
          <Card padded={false}>
            <ul className="divide-y divide-[#f0f3f0]">
              {subjects.data.subjects.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-[#edf2ed] text-[#4a6654]"><BookMarked size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block font-medium text-[#17221d]">{s.name}</span>{s.description && <span className="block truncate text-xs text-[#7d8981]">{s.description}</span>}</span>
                  <Badge>{s.classes} class{s.classes === 1 ? "" : "es"}</Badge>
                  <button onClick={() => setEditingSubject(s)} aria-label="Edit" className="rounded-md p-2 text-[#66736c] hover:bg-[#f1f4f1]"><Pencil size={15} /></button>
                  <ConfirmButton icon={Trash2} label="" confirmLabel="Delete everywhere?" variant="ghost" onConfirm={async () => { try { await api(`/subjects/${s.id}`, { method: "DELETE" }); subjects.reload(); classes.reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : classes.error ? <ErrorNote message={classes.error} /> : classes.loading ? <Loading /> : !classes.data?.classes.length ? (
        <EmptyState icon={GraduationCap} title={full ? "No classes yet" : "No classes assigned"} description={full ? "Create classes like “Class 1” or “Grade 10 – A”, then add subjects to them." : "Ask an administrator to give your role access to classes."} action={manage && full && <Button icon={Plus} onClick={() => setEditing("new")}>New class</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.data.classes.map((c) => (
            <Link key={c.id} href={`/classes/${c.id}`} className="group rounded-xl border border-[#e2e8e3] bg-white p-5 transition hover:border-[#b9c6bc] hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-lg bg-[#17221d] text-sm font-bold text-white">{c.grade ?? c.name.charAt(0)}</span><div><h3 className="font-semibold text-[#17221d] group-hover:underline">{c.name}</h3><p className="text-xs text-[#7d8981]">{c.subjects.length} subject{c.subjects.length === 1 ? "" : "s"}</p></div></div>
                {manage && full && <button onClick={(e) => { e.preventDefault(); setEditing(c); }} aria-label="Edit class" className="rounded-md p-2 text-[#66736c] hover:bg-[#f1f4f1]"><Pencil size={15} /></button>}
              </div>
              {c.description && <p className="mt-3 line-clamp-2 text-sm text-[#5d6c62]">{c.description}</p>}
              <div className="mt-4 flex flex-wrap gap-1.5">{c.subjects.length ? c.subjects.map((s) => <Badge key={s.classSubjectId} tone="green">{s.name}{s.topics ? ` · ${s.topics} topic${s.topics === 1 ? "" : "s"}` : ""}</Badge>) : <span className="text-xs text-[#9aa59d]">No subjects yet</span>}</div>
            </Link>
          ))}
        </div>
      )}

      {editing && <ClassForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); classes.reload(); }} />}
      {editingSubject && <SubjectForm item={editingSubject === "new" ? null : editingSubject} onClose={() => setEditingSubject(null)} onSaved={() => { setEditingSubject(null); subjects.reload(); }} />}
    </>
  );
}

function ClassForm({ item, onClose, onSaved }: { item: { id: string; name: string; grade: number | null; description: string | null } | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: item?.name ?? "", grade: item?.grade?.toString() ?? "", description: item?.description ?? "" });
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(item ? `/classes/${item.id}` : "/classes", { method: item ? "PUT" : "POST", body: { name: form.name, grade: form.grade ? Number(form.grade) : null, description: form.description || null } });
      toast.success(item ? "Class updated" : "Class created");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={item ? "Edit class" : "New class"} footer={<>{item && <ConfirmButton size="md" icon={Trash2} label="Delete class" onConfirm={async () => { try { await api(`/classes/${item.id}`, { method: "DELETE" }); toast.success("Class deleted"); onSaved(); } catch (e) { toast.error(errorMessage(e)); } }} />}<span className="flex-1" /><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="class-form" type="submit" loading={saving}>Save</Button></>}>
      <form id="class-form" onSubmit={save} className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Class name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Class 10 – A" /></Field>
        <Field label="Grade" hint="For sorting"><Input type="number" min={0} max={20} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" /></Field>
      </form>
    </Modal>
  );
}

function SubjectForm({ item, onClose, onSaved }: { item: SubjectRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: item?.name ?? "", description: item?.description ?? "" });
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(item ? `/subjects/${item.id}` : "/subjects", { method: item ? "PUT" : "POST", body: { name: form.name, description: form.description || null } });
      toast.success("Subject saved");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={item ? "Edit subject" : "New subject"} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="subject-form" type="submit" loading={saving}>Save</Button></>}>
      <form id="subject-form" onSubmit={save} className="space-y-4">
        <Field label="Subject name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Physics" /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" /></Field>
      </form>
    </Modal>
  );
}
