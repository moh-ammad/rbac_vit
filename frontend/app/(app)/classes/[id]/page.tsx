"use client";

import { ArrowLeft, BookOpen, ClipboardList, PlayCircle, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Card, EmptyState, ErrorNote, Loading, SectionTitle } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";

type Person = { id: string; name: string; email: string; roleName: string };
type Detail = {
  class: { id: string; name: string; grade: number | null; description: string | null };
  subjects: { classSubjectId: string; subjectId: string; name: string; topics: { id: string; name: string }[]; counts: { resources: number; videos: number; papers: number }; teachers: Person[] }[];
  teachers: (Person & { subjects: string[] })[];
  students: Person[];
  studentCount: number;
};

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { me, can } = useAuth();
  const manage = can("classes.manage");
  const fullClass = me?.classSubjectIds === null;
  const detail = useApi<Detail>(`/classes/${id}`);
  const allSubjects = useApi<{ subjects: { id: string; name: string }[] }>(manage && fullClass ? "/subjects" : null);
  const [subjectChoice, setSubjectChoice] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});

  if (detail.loading && !detail.data) return <Loading />;
  if (detail.error || !detail.data) return <ErrorNote message={detail.error ?? "Class not found"} />;
  const d = detail.data;
  const linked = new Set(d.subjects.map((s) => s.subjectId));

  async function addSubject() {
    try {
      await api(`/classes/${id}/subjects`, { method: "POST", body: subjectChoice === "__new" ? { name: newSubject } : { subjectId: subjectChoice } });
      toast.success("Subject added to class");
      setSubjectChoice(""); setNewSubject("");
      detail.reload(); allSubjects.reload();
    } catch (e) { toast.error(errorMessage(e)); }
  }

  async function addTopic(classSubjectId: string) {
    const name = topicDrafts[classSubjectId]?.trim();
    if (!name) return;
    try {
      await api(`/class-subjects/${classSubjectId}/topics`, { method: "POST", body: { name } });
      setTopicDrafts({ ...topicDrafts, [classSubjectId]: "" });
      detail.reload();
    } catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <>
      <Link href="/classes" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#4a6654] hover:underline"><ArrowLeft size={15} />All classes</Link>
      <div className="mb-7 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-xl bg-[#17221d] text-lg font-bold text-white">{d.class.grade ?? d.class.name.charAt(0)}</span>
        <div><h1 className="text-[28px] font-semibold tracking-tight text-[#17221d]">{d.class.name}</h1><p className="text-sm text-[#66736c]">{d.subjects.length} subjects · {d.teachers.length} teachers · {d.studentCount} students{d.class.description ? ` · ${d.class.description}` : ""}</p></div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {manage && fullClass && (
            <Card className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-[#34433a]">Add a subject to this class</span>
              <Select value={subjectChoice} onChange={(e) => setSubjectChoice(e.target.value)} className="sm:w-56">
                <option value="">Choose subject…</option>
                {(allSubjects.data?.subjects ?? []).filter((s) => !linked.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="__new">+ New subject…</option>
              </Select>
              {subjectChoice === "__new" && <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Subject name" className="sm:w-48" />}
              <Button icon={Plus} disabled={!subjectChoice || (subjectChoice === "__new" && !newSubject.trim())} onClick={addSubject}>Add</Button>
            </Card>
          )}
          {!d.subjects.length && <EmptyState icon={BookOpen} title="No subjects in this class yet" description={manage ? "Add subjects above." : undefined} />}
          {d.subjects.map((s) => (
            <Card key={s.classSubjectId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-[#17221d]">{s.name}</h2><p className="mt-0.5 text-sm text-[#6b786f]">{s.teachers.length ? `Taught by ${s.teachers.map((t) => t.name).join(", ")}` : "No teacher assigned yet"}</p></div>
                <div className="flex items-center gap-3 text-xs text-[#66736c]">
                  <span className="inline-flex items-center gap-1"><BookOpen size={13} />{s.counts.resources}</span>
                  <span className="inline-flex items-center gap-1"><PlayCircle size={13} />{s.counts.videos}</span>
                  <span className="inline-flex items-center gap-1"><ClipboardList size={13} />{s.counts.papers}</span>
                  {manage && fullClass && <ConfirmButton icon={Trash2} label="" confirmLabel="Remove subject & its content?" variant="ghost" onConfirm={async () => { try { await api(`/class-subjects/${s.classSubjectId}`, { method: "DELETE" }); detail.reload(); } catch (e) { toast.error(errorMessage(e)); } }} />}
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[.08em] text-[#7d8981]">Topics</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {s.topics.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1 rounded-md bg-[#eef1ee] py-1 pl-2.5 pr-1.5 text-xs font-medium text-[#3e4c43]">
                      {t.name}
                      {manage && <button onClick={async () => { try { await api(`/topics/${t.id}`, { method: "DELETE" }); detail.reload(); } catch (e) { toast.error(errorMessage(e)); } }} aria-label={`Remove ${t.name}`} className="rounded p-0.5 text-[#8a958e] hover:bg-white hover:text-red-600"><X size={12} /></button>}
                    </span>
                  ))}
                  {!s.topics.length && <span className="text-xs text-[#9aa59d]">No topics yet</span>}
                  {manage && (
                    <form onSubmit={(e) => { e.preventDefault(); void addTopic(s.classSubjectId); }} className="flex items-center gap-1">
                      <input value={topicDrafts[s.classSubjectId] ?? ""} onChange={(e) => setTopicDrafts({ ...topicDrafts, [s.classSubjectId]: e.target.value })} placeholder="+ topic" className="h-7 w-28 rounded-md border border-dashed border-[#c8d3ca] bg-white px-2 text-xs outline-none focus:w-40 focus:border-[#6c8872]" />
                    </form>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <SectionTitle>Teachers</SectionTitle>
            {d.teachers.length ? <ul className="space-y-3">{d.teachers.map((t) => <li key={`${t.id}-${t.roleName}`} className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e5eef9] text-[#2f5d91]"><UserRound size={16} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#17221d]">{t.name}</p><p className="truncate text-xs text-[#7d8981]">{t.subjects.join(", ") || "Class teacher"} · {t.roleName}</p></div></li>)}</ul> : <p className="text-sm text-[#7d8981]">No teacher roles cover this class yet. In Settings, tick this class on a Teacher role.</p>}
          </Card>
          <Card>
            <SectionTitle>Students {d.studentCount ? `(${d.studentCount})` : ""}</SectionTitle>
            {d.students.length ? <ul className="max-h-96 space-y-2.5 overflow-y-auto">{d.students.map((s) => <li key={s.id} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#edf2ed] text-xs font-semibold text-[#365341]">{s.name.charAt(0)}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-[#17221d]">{s.name}</p><p className="truncate text-xs text-[#8a958e]">{s.roleName}</p></div></li>)}</ul> : d.studentCount ? <p className="flex items-center gap-2 text-sm text-[#66736c]"><Users size={15} />{d.studentCount} classmates</p> : <p className="text-sm text-[#7d8981]">No student roles cover this class yet.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
