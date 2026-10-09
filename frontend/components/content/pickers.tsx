"use client";

// Class / subject / topic pickers shared by every content form and filter.
// Options come from /api/class-subjects, which only returns what the user's
// role can reach — so a Science Teacher can only ever pick their own subjects.

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Select } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { ClassSubjectOption } from "@/types";

export function useClassSubjects() {
  const result = useApi<{ classSubjects: ClassSubjectOption[] }>("/class-subjects");
  return { options: result.data?.classSubjects ?? [], loading: result.loading, reload: result.reload };
}

/** One dropdown grouped by class: "Class 10 → Physics". */
export function ClassSubjectSelect({ options, value, onChange, noneLabel }: { options: ClassSubjectOption[]; value: string; onChange: (id: string) => void; noneLabel?: string }) {
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: ClassSubjectOption[] }>();
    for (const o of options) {
      const g = map.get(o.class.id) ?? { name: o.class.name, items: [] };
      g.items.push(o);
      map.set(o.class.id, g);
    }
    return [...map.values()];
  }, [options]);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{noneLabel ?? "Choose class & subject"}</option>
      {groups.map((g) => <optgroup key={g.name} label={g.name}>{g.items.map((o) => <option key={o.id} value={o.id}>{o.class.name} · {o.subject.name}</option>)}</optgroup>)}
    </Select>
  );
}

/** Topic dropdown for a class-subject, with inline "new topic". */
export function TopicSelect({ option, value, onChange, canCreate, onCreated }: { option: ClassSubjectOption | undefined; value: string; onChange: (id: string) => void; canCreate: boolean; onCreated: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!option) return <Select disabled value=""><option>Pick a subject first</option></Select>;

  async function create() {
    if (!option || !name.trim()) return;
    try {
      const { topic } = await api<{ topic: { id: string } }>(`/class-subjects/${option.id}/topics`, { method: "POST", body: { name: name.trim() } });
      onCreated();
      onChange(topic.id);
      setAdding(false);
      setName("");
      toast.success("Topic added");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void create(); } }} placeholder="New topic name" className="h-10 min-w-0 flex-1 rounded-lg border border-[#d9e2db] px-3 text-sm outline-none focus:border-[#6c8872]" />
        <button type="button" onClick={create} className="rounded-lg bg-[#17221d] px-3 text-sm font-semibold text-white">Add</button>
        <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-2 text-sm text-[#66736c]">Cancel</button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No specific topic</option>
        {option.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      {canCreate && <button type="button" onClick={() => setAdding(true)} title="New topic" className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#d9e2db] text-[#4a6654] hover:bg-[#f1f4f1]"><Plus size={16} /></button>}
    </div>
  );
}

/** Class + subject filter dropdowns derived from the user's options. */
export function ClassSubjectFilters({ options, classId, subjectId, onChange }: { options: ClassSubjectOption[]; classId: string; subjectId: string; onChange: (next: { classId: string; subjectId: string }) => void }) {
  const classes = useMemo(() => [...new Map(options.map((o) => [o.class.id, o.class])).values()], [options]);
  const subjects = useMemo(() => [...new Map(options.filter((o) => !classId || o.class.id === classId).map((o) => [o.subject.id, o.subject])).values()].sort((a, b) => a.name.localeCompare(b.name)), [options, classId]);
  return (
    <>
      <Select value={classId} onChange={(e) => onChange({ classId: e.target.value, subjectId: "" })} className="sm:w-44" aria-label="Class">
        <option value="">All classes</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Select value={subjectId} onChange={(e) => onChange({ classId, subjectId: e.target.value })} className="sm:w-44" aria-label="Subject">
        <option value="">All subjects</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
    </>
  );
}

export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-2 text-sm">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-[#d9e2db] bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
      <span className="px-2 text-[#66736c]">Page {page} of {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-[#d9e2db] bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
    </div>
  );
}
