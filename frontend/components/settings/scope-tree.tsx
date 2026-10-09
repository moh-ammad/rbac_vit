"use client";

// Nested checkboxes: Class ▸ Subjects.
//  • tick a class            → the whole class, including subjects added later
//  • tick some subjects       → only those subjects (class shows "partly")
//  • untick the last subject  → the class is removed

import { ChevronRight, GraduationCap, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/display";
import type { ScopeEntry, ScopeTreeClass } from "@/types";

export function scopeSummary(value: ScopeEntry[], tree: ScopeTreeClass[]) {
  let subjects = 0;
  for (const entry of value) {
    const cls = tree.find((c) => c.id === entry.classId);
    subjects += entry.allSubjects ? cls?.subjects.length ?? 0 : entry.classSubjectIds.length;
  }
  return `${value.length} class${value.length === 1 ? "" : "es"} · ${subjects} subject${subjects === 1 ? "" : "s"}`;
}

export function ScopeTree({ tree, value, onChange, disabled }: { tree: ScopeTreeClass[]; value: ScopeEntry[]; onChange: (next: ScopeEntry[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(value.map((v) => [v.classId, true])));
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => tree.filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()) || c.subjects.some((s) => s.name.toLowerCase().includes(filter.toLowerCase()))), [tree, filter]);

  if (!tree.length) {
    return <div className="rounded-lg border border-dashed border-[#d3dcd5] bg-[#fafbfa] px-4 py-6 text-center text-sm text-[#6b786f]">No classes yet. Create classes and subjects on the <Link href="/classes" className="font-semibold text-[#2f6b45] underline">Classes</Link> page, then come back to tick them here.</div>;
  }

  const entryFor = (classId: string) => value.find((v) => v.classId === classId);
  const selectedSubjects = (cls: ScopeTreeClass) => {
    const entry = entryFor(cls.id);
    if (!entry) return [] as string[];
    return entry.allSubjects ? cls.subjects.map((s) => s.classSubjectId) : entry.classSubjectIds;
  };

  function setClass(cls: ScopeTreeClass, on: boolean) {
    const rest = value.filter((v) => v.classId !== cls.id);
    onChange(on ? [...rest, { classId: cls.id, allSubjects: true, classSubjectIds: [] }] : rest);
    if (on) setOpen((o) => ({ ...o, [cls.id]: true }));
  }

  function setSubject(cls: ScopeTreeClass, classSubjectId: string, on: boolean) {
    const current = new Set(selectedSubjects(cls));
    if (on) current.add(classSubjectId); else current.delete(classSubjectId);
    const rest = value.filter((v) => v.classId !== cls.id);
    if (current.size === 0) return onChange(rest);
    if (current.size === cls.subjects.length) return onChange([...rest, { classId: cls.id, allSubjects: true, classSubjectIds: [] }]);
    onChange([...rest, { classId: cls.id, allSubjects: false, classSubjectIds: [...current] }]);
  }

  const allOpen = shown.every((c) => open[c.id]);

  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8e3]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#edf1ee] bg-[#fafbfa] px-4 py-2.5">
        <div className="relative min-w-40 flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b968e]" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter classes or subjects" className="h-8 w-full rounded-md border border-[#dfe6e0] bg-white pl-8 pr-2 text-xs outline-none focus:border-[#6c8872]" />
        </div>
        <button type="button" onClick={() => setOpen(Object.fromEntries(shown.map((c) => [c.id, !allOpen])))} className="text-xs font-semibold text-[#2f6b45] hover:underline">{allOpen ? "Collapse all" : "Expand all"}</button>
        <span className="text-xs text-[#6b786f]">{scopeSummary(value, tree)}</span>
      </div>
      <ul className="max-h-[440px] divide-y divide-[#f0f3f0] overflow-y-auto">
        {shown.map((cls) => {
          const chosen = selectedSubjects(cls);
          const entry = entryFor(cls.id);
          const full = Boolean(entry && (entry.allSubjects || chosen.length === cls.subjects.length));
          const partial = Boolean(entry && !full);
          const isOpen = open[cls.id] ?? Boolean(entry);
          return (
            <li key={cls.id} className={entry ? "bg-[#f7fbf8]" : ""}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [cls.id]: !isOpen }))} disabled={!cls.subjects.length} aria-label={isOpen ? "Collapse" : "Expand"} className="rounded p-0.5 text-[#7d8981] hover:bg-[#eef2ee] disabled:opacity-30">
                  <ChevronRight size={16} className={`transition ${isOpen ? "rotate-90" : ""}`} />
                </button>
                <Checkbox checked={full} indeterminate={partial} disabled={disabled} onChange={(next) => setClass(cls, partial ? true : next)} label={<span className="flex items-center gap-2 font-medium"><GraduationCap size={15} className="text-[#6b786f]" />{cls.name}</span>} />
                <span className="ml-auto flex items-center gap-2">
                  {entry?.allSubjects && cls.subjects.length > 0 && <Badge tone="green">All subjects</Badge>}
                  {partial && <Badge tone="amber">{chosen.length} of {cls.subjects.length}</Badge>}
                  <span className="text-xs text-[#9aa59d]">{cls.subjects.length} subject{cls.subjects.length === 1 ? "" : "s"}</span>
                </span>
              </div>
              {isOpen && cls.subjects.length > 0 && (
                <ul className="relative mb-2 ml-[42px] mr-3 border-l-2 border-[#e2e9e3] pl-4">
                  {cls.subjects.map((s) => (
                    <li key={s.classSubjectId} className="relative py-1.5 before:absolute before:-left-4 before:top-1/2 before:h-px before:w-3 before:bg-[#e2e9e3]">
                      <Checkbox checked={chosen.includes(s.classSubjectId)} disabled={disabled} onChange={(next) => setSubject(cls, s.classSubjectId, next)} label={s.name} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="px-4 py-6 text-center text-sm text-[#7d8981]">No class matches “{filter}”.</li>}
      </ul>
    </div>
  );
}
