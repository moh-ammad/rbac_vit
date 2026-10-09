"use client";

import { BarChart3, ClipboardList, Clock, PlayCircle, Plus, RotateCcw, SearchX, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ClassSubjectFilters, ClassSubjectSelect, useClassSubjects } from "@/components/content/pickers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorNote, Loading, PageHeader, ScoreBar, Tabs } from "@/components/ui/display";
import { Field, Input, SearchInput, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";
import type { ClassSubjectLabel, Paper } from "@/types";

export default function QuestionPapersPage() {
  const { can } = useAuth();
  const manage = can("papers.manage");
  const { me } = useAuth();
  const student = can("papers.attempt") && !me?.isSuperAdmin;
  const results = can("results.view");
  const { options } = useClassSubjects();
  const [tab, setTab] = useState<"papers" | "mine">("papers");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ classId: "", subjectId: "" });
  const search = useDebounced(q);
  const list = useApi<{ papers: Paper[] }>(tab === "papers" ? `/papers${qs({ q: search, ...filters })}` : null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Question papers"
        subtitle={student && !manage ? "Tests for your classes. Your answers are analysed topic by topic." : "Create papers, tag questions with topics, publish them as tests and follow the results."}
        action={<>{student && <Tabs value={tab} onChange={setTab} items={[{ value: "papers", label: "Tests" }, { value: "mine", label: "My results" }]} />}{manage && <Button icon={Plus} onClick={() => setCreating(true)}>New paper</Button>}</>}
      />

      {tab === "mine" ? <MyResults /> : (
        <>
          <div className="mb-6 flex flex-col gap-3 lg:flex-row">
            <SearchInput value={q} onChange={setQ} placeholder="Search papers…" className="lg:max-w-md lg:flex-1" />
            <div className="flex flex-col gap-3 sm:flex-row"><ClassSubjectFilters options={options} classId={filters.classId} subjectId={filters.subjectId} onChange={setFilters} /></div>
          </div>
          {list.error ? <ErrorNote message={list.error} /> : list.loading && !list.data ? <Loading /> : !list.data?.papers.length ? (
            q || filters.classId ? <EmptyState icon={SearchX} title="No papers match" /> : <EmptyState icon={ClipboardList} title="No question papers yet" description={manage ? "Create a paper, add multiple-choice questions and publish it." : "Published tests for your classes will show up here."} action={manage && <Button icon={Plus} onClick={() => setCreating(true)}>New paper</Button>} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.data.papers.map((p) => (
                <Card key={p.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/question-papers/${p.id}`} className="font-semibold leading-snug text-[#17221d] hover:underline">{p.title}</Link>
                      <p className="mt-1 text-sm text-[#6b786f]">{p.classSubject.classGroup.name} · {p.classSubject.subject.name}</p>
                    </div>
                    {manage && <Badge tone={p.isPublished ? "green" : "amber"}>{p.isPublished ? "Published" : "Draft"}</Badge>}
                  </div>
                  {p.description && <p className="mt-3 line-clamp-2 text-sm text-[#5d6c62]">{p.description}</p>}
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#6b786f]">
                    <span>{p.questions} question{p.questions === 1 ? "" : "s"}</span>
                    {p.durationMinutes && <span className="inline-flex items-center gap-1"><Clock size={12} />{p.durationMinutes} min</span>}
                    {(manage || results) && <span>{p.attempts} attempt{p.attempts === 1 ? "" : "s"}</span>}
                    <span>{formatDate(p.createdAt)}</span>
                  </div>
                  {student && p.myLatest && (
                    <div className="mt-4 rounded-lg bg-[#f6f8f6] p-3">
                      <div className="mb-1.5 flex justify-between text-xs"><span className="text-[#5d6c62]">Your latest score</span><span className="font-semibold text-[#17221d]">{p.myLatest.percentage}%</span></div>
                      <ScoreBar value={p.myLatest.percentage} />
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {student && p.isPublished && (p.myLatest
                      ? <><ButtonLink href={`/results/${p.myLatest.attemptId}`} size="sm" variant="secondary" icon={BarChart3}>View analysis</ButtonLink><ButtonLink href={`/question-papers/${p.id}/take`} size="sm" variant="ghost" icon={RotateCcw}>Retake</ButtonLink></>
                      : <ButtonLink href={`/question-papers/${p.id}/take`} size="sm" icon={PlayCircle}>Start test</ButtonLink>)}
                    {(manage || results) && <ButtonLink href={`/question-papers/${p.id}`} size="sm" variant="secondary" icon={manage ? Settings2 : BarChart3}>{manage ? "Manage" : "Results"}</ButtonLink>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {creating && <NewPaper options={options} onClose={() => setCreating(false)} />}
    </>
  );
}

function MyResults() {
  const { data, loading, error } = useApi<{ attempts: { id: string; score: number; total: number; percentage: number; submittedAt: string; paper: { id: string; title: string; classSubject: ClassSubjectLabel } }[] }>("/attempts/mine");
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;
  if (!data?.attempts.length) return <EmptyState icon={BarChart3} title="No results yet" description="Take a test and your score and topic analysis will appear here." />;
  return (
    <Card padded={false}>
      <table className="w-full text-sm">
        <thead className="border-b border-[#edf1ee] text-left text-xs uppercase tracking-wide text-[#7d8981]"><tr><th className="px-5 py-3 font-medium">Paper</th><th className="hidden px-5 py-3 font-medium sm:table-cell">Subject</th><th className="px-5 py-3 font-medium">Score</th><th className="hidden px-5 py-3 font-medium md:table-cell">Date</th><th /></tr></thead>
        <tbody className="divide-y divide-[#f0f3f0]">
          {data.attempts.map((a) => (
            <tr key={a.id} className="hover:bg-[#fafbfa]">
              <td className="px-5 py-3 font-medium text-[#17221d]">{a.paper.title}</td>
              <td className="hidden px-5 py-3 text-[#5d6c62] sm:table-cell">{a.paper.classSubject.subject.name}</td>
              <td className="px-5 py-3"><div className="flex w-36 items-center gap-2"><ScoreBar value={a.percentage} /><span className="w-10 text-right font-semibold">{Math.round(a.percentage)}%</span></div></td>
              <td className="hidden px-5 py-3 text-[#7d8981] md:table-cell">{formatDate(a.submittedAt, true)}</td>
              <td className="px-5 py-3 text-right"><Link href={`/results/${a.id}`} className="text-sm font-semibold text-[#2f6b45] hover:underline">Analysis</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function NewPaper({ options, onClose }: { options: ReturnType<typeof useClassSubjects>["options"]; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", classSubjectId: "", durationMinutes: "", description: "" });
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const { paper } = await api<{ paper: { id: string } }>("/papers", { method: "POST", body: { title: form.title, classSubjectId: form.classSubjectId, durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null, description: form.description || null } });
      toast.success("Paper created — now add questions");
      router.push(`/question-papers/${paper.id}`);
    } catch (e) { toast.error(errorMessage(e)); setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title="New question paper" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="paper-form" type="submit" loading={saving}>Create & add questions</Button></>}>
      <form id="paper-form" onSubmit={save} className="space-y-4">
        <Field label="Title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Unit test — Light" /></Field>
        <Field label="Class & subject"><ClassSubjectSelect options={options} value={form.classSubjectId} onChange={(id) => setForm({ ...form, classSubjectId: id })} /></Field>
        <Field label="Time limit (minutes)" hint="Leave empty for no limit."><Input type="number" min={1} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></Field>
        <Field label="Instructions for students"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" /></Field>
      </form>
    </Modal>
  );
}
