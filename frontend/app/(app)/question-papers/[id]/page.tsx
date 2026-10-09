"use client";

import { ArrowLeft, BarChart3, CheckCircle2, Clock, Eye, EyeOff, ListChecks, Pencil, PlayCircle, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TopicBreakdown } from "@/components/analysis/analysis";
import { ClassSubjectSelect, TopicSelect, useClassSubjects } from "@/components/content/pickers";
import { Button, ButtonLink, ConfirmButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorNote, Loading, ScoreBar, SectionTitle, StatCard, Tabs } from "@/components/ui/display";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { ClassSubjectLabel, Question, TopicStat } from "@/types";

type PaperDetail = { id: string; title: string; description: string | null; durationMinutes: number | null; isPublished: boolean; createdAt: string; classSubject: ClassSubjectLabel; createdBy: { name: string } | null; questions: Question[]; totalMarks: number };

export default function PaperPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const manage = can("papers.manage");
  const canResults = can("results.view");
  const [tab, setTab] = useState<"questions" | "results">(manage ? "questions" : "results");
  const paper = useApi<{ paper: PaperDetail }>(`/papers/${id}`);
  const { options, reload: reloadOptions } = useClassSubjects();
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [editingPaper, setEditingPaper] = useState(false);

  if (paper.loading && !paper.data) return <Loading />;
  if (paper.error || !paper.data) return <ErrorNote message={paper.error ?? "Not found"} />;
  const p = paper.data.paper;
  const option = options.find((o) => o.id === p.classSubject.id);

  async function setPublished(isPublished: boolean) {
    try {
      await api(`/papers/${p.id}`, { method: "PUT", body: { title: p.title, description: p.description, classSubjectId: p.classSubject.id, durationMinutes: p.durationMinutes, isPublished } });
      toast.success(isPublished ? "Published — students can take it now" : "Moved back to draft");
      paper.reload();
    } catch (e) { toast.error(errorMessage(e)); }
  }

  // Students (no manage / results rights) get a start screen.
  if (!manage && !canResults) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-8 text-center">
          <ListChecks className="mx-auto text-[#4a6654]" size={36} />
          <h1 className="mt-4 text-2xl font-semibold text-[#17221d]">{p.title}</h1>
          <p className="mt-1 text-sm text-[#6b786f]">{p.classSubject.classGroup.name} · {p.classSubject.subject.name}</p>
          {p.description && <p className="mt-4 text-sm leading-6 text-[#4c5a51]">{p.description}</p>}
          <p className="mt-4 text-sm text-[#5d6c62]">{p.questions.length} questions · {p.totalMarks} marks{p.durationMinutes ? ` · ${p.durationMinutes} minutes` : ""}</p>
          <ButtonLink href={`/question-papers/${p.id}/take`} icon={PlayCircle} className="mt-6">Start test</ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Link href="/question-papers" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#4a6654] hover:underline"><ArrowLeft size={15} />All papers</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-[28px] font-semibold tracking-tight text-[#17221d]">{p.title}</h1><Badge tone={p.isPublished ? "green" : "amber"}>{p.isPublished ? "Published" : "Draft"}</Badge></div>
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-sm text-[#66736c]"><span>{p.classSubject.classGroup.name} · {p.classSubject.subject.name}</span><span>{p.questions.length} questions · {p.totalMarks} marks</span>{p.durationMinutes && <span className="inline-flex items-center gap-1"><Clock size={13} />{p.durationMinutes} min</span>}{p.createdBy && <span>by {p.createdBy.name}</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(manage && canResults) && <Tabs value={tab} onChange={setTab} items={[{ value: "questions", label: "Questions" }, { value: "results", label: "Results" }]} />}
          {manage && <Button variant="secondary" icon={Pencil} onClick={() => setEditingPaper(true)}>Edit details</Button>}
          {manage && (p.isPublished ? <Button variant="secondary" icon={EyeOff} onClick={() => setPublished(false)}>Unpublish</Button> : <Button icon={Eye} onClick={() => setPublished(true)} disabled={!p.questions.length}>Publish</Button>)}
          {manage && <ConfirmButton size="md" icon={Trash2} label="Delete" onConfirm={async () => { try { await api(`/papers/${p.id}`, { method: "DELETE" }); toast.success("Paper deleted"); router.replace("/question-papers"); } catch (e) { toast.error(errorMessage(e)); } }} />}
        </div>
      </div>

      {tab === "results" ? <PaperResults paperId={p.id} /> : (
        <div className="space-y-3">
          {p.questions.length === 0 && <EmptyState icon={ListChecks} title="No questions yet" description="Add multiple-choice questions and tag each with a topic so results can be analysed." />}
          {p.questions.map((q, i) => (
            <Card key={q.id}>
              <div className="flex items-start gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf2ed] text-sm font-semibold text-[#2f6b45]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-6 text-[#17221d]">{q.prompt}</p>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, idx) => <li key={idx} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${idx === q.correctIndex ? "bg-[#e3f0e6] font-medium text-[#1f5634]" : "bg-[#f6f8f6] text-[#4c5a51]"}`}>{idx === q.correctIndex ? <CheckCircle2 size={15} /> : <span className="w-[15px] text-center text-xs text-[#9aa59d]">{String.fromCharCode(65 + idx)}</span>}{opt}</li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">{q.topic ? <Badge tone="green">#{q.topic.name}</Badge> : <Badge tone="amber">No topic</Badge>}<Badge>{q.marks} mark{q.marks === 1 ? "" : "s"}</Badge>{q.explanation && <span className="text-xs text-[#7d8981]">· has explanation</span>}</div>
                </div>
                {manage && <div className="flex shrink-0 gap-1"><button onClick={() => setEditing(q)} aria-label="Edit question" className="rounded-md p-2 text-[#66736c] hover:bg-[#f1f4f1]"><Pencil size={15} /></button><ConfirmButton icon={Trash2} label="" confirmLabel="Delete?" variant="ghost" onConfirm={async () => { try { await api(`/questions/${q.id}`, { method: "DELETE" }); paper.reload(); } catch (e) { toast.error(errorMessage(e)); } }} /></div>}
              </div>
            </Card>
          ))}
          {manage && <button onClick={() => setEditing("new")} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cdd8cf] py-5 text-sm font-semibold text-[#2f6b45] hover:bg-[#f2f8f3]"><Plus size={17} />Add question</button>}
        </div>
      )}

      {editing && <QuestionForm paperId={p.id} question={editing === "new" ? null : editing} option={option} onTopicCreated={reloadOptions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); paper.reload(); }} />}
      {editingPaper && <PaperForm paper={p} options={options} onClose={() => setEditingPaper(false)} onSaved={() => { setEditingPaper(false); paper.reload(); }} />}
    </>
  );
}

function QuestionForm({ paperId, question, option, onClose, onSaved, onTopicCreated }: { paperId: string; question: Question | null; option: ReturnType<typeof useClassSubjects>["options"][number] | undefined; onClose: () => void; onSaved: () => void; onTopicCreated: () => void }) {
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [opts, setOpts] = useState<string[]>(question?.options ?? ["", "", "", ""]);
  const [correct, setCorrect] = useState(question?.correctIndex ?? 0);
  const [marks, setMarks] = useState(String(question?.marks ?? 1));
  const [topicId, setTopicId] = useState(question?.topic?.id ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const filled = opts.map((o) => o.trim());
    if (filled.some((o) => !o)) return toast.error("Fill in every option or remove empty ones");
    setSaving(true);
    try {
      await api(question ? `/questions/${question.id}` : `/papers/${paperId}/questions`, { method: question ? "PUT" : "POST", body: { prompt, options: filled, correctIndex: correct, marks: Number(marks) || 1, topicId: topicId || null, explanation: explanation || null } });
      toast.success(question ? "Question updated" : "Question added");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} wide title={question ? "Edit question" : "Add question"} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="question-form" type="submit" loading={saving}>{question ? "Save" : "Add question"}</Button></>}>
      <form id="question-form" onSubmit={save} className="space-y-4">
        <Field label="Question"><Textarea required value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-20" /></Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-[#34433a]">Options — tick the correct one</span>
          <div className="space-y-2">
            {opts.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button type="button" onClick={() => setCorrect(i)} aria-label={`Mark option ${i + 1} correct`} className={`grid size-9 shrink-0 place-items-center rounded-lg border text-sm font-semibold ${correct === i ? "border-[#2f6b45] bg-[#2f6b45] text-white" : "border-[#d9e2db] text-[#7d8981] hover:border-[#6c8872]"}`}>{correct === i ? <CheckCircle2 size={16} /> : String.fromCharCode(65 + i)}</button>
                <Input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                {opts.length > 2 && <button type="button" onClick={() => { setOpts(opts.filter((_, j) => j !== i)); setCorrect((c) => (c === i ? 0 : c > i ? c - 1 : c)); }} aria-label="Remove option" className="rounded-md p-2 text-[#9aa59d] hover:bg-[#f1f4f1]"><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
          {opts.length < 6 && <button type="button" onClick={() => setOpts([...opts, ""])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#2f6b45] hover:underline"><Plus size={14} />Add option</button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Topic" hint="Used to find weak areas and recommend videos."><TopicSelect option={option} value={topicId} onChange={setTopicId} canCreate onCreated={onTopicCreated} /></Field>
          <Field label="Marks"><Input type="number" min={1} max={100} value={marks} onChange={(e) => setMarks(e.target.value)} /></Field>
        </div>
        <Field label="Explanation (shown after the test)"><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="min-h-16" /></Field>
      </form>
    </Modal>
  );
}

function PaperForm({ paper, options, onClose, onSaved }: { paper: PaperDetail; options: ReturnType<typeof useClassSubjects>["options"]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: paper.title, classSubjectId: paper.classSubject.id, durationMinutes: paper.durationMinutes ? String(paper.durationMinutes) : "", description: paper.description ?? "" });
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(`/papers/${paper.id}`, { method: "PUT", body: { title: form.title, classSubjectId: form.classSubjectId, durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null, description: form.description || null } });
      toast.success("Saved");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title="Edit paper" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="edit-paper" type="submit" loading={saving}>Save</Button></>}>
      <form id="edit-paper" onSubmit={save} className="space-y-4">
        <Field label="Title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Class & subject"><ClassSubjectSelect options={options} value={form.classSubjectId} onChange={(id) => setForm({ ...form, classSubjectId: id })} /></Field>
        <Field label="Time limit (minutes)"><Input type="number" min={1} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></Field>
        <Field label="Instructions for students"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}

type PaperResultsData = {
  summary: { students: number; attempts: number; average: number | null; highest: number | null; lowest: number | null };
  students: { attemptId: string; user: { id: string; name: string; email: string }; score: number; total: number; percentage: number; submittedAt: string; tries: number }[];
  topics: TopicStat[];
  questions: { number: number; id: string; prompt: string; topic: string | null; attempts: number; correctRate: number | null }[];
  distribution: { label: string; count: number }[];
};

function PaperResults({ paperId }: { paperId: string }) {
  const { data, loading, error } = useApi<PaperResultsData>(`/papers/${paperId}/results`);
  if (loading) return <Loading label="Analysing results" />;
  if (error || !data) return <ErrorNote message={error ?? "No data"} />;
  if (!data.summary.students) return <EmptyState icon={BarChart3} title="No attempts yet" description="Results and class-wide topic analysis appear once students submit this test." />;
  const maxBucket = Math.max(1, ...data.distribution.map((d) => d.count));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Students attempted" value={data.summary.students} hint={`${data.summary.attempts} attempts in total`} />
        <StatCard icon={BarChart3} label="Class average" value={`${data.summary.average}%`} tone="blue" />
        <StatCard icon={CheckCircle2} label="Highest" value={`${data.summary.highest}%`} tone="green" />
        <StatCard icon={ListChecks} label="Lowest" value={`${data.summary.lowest}%`} tone="red" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><SectionTitle>Class performance by topic</SectionTitle><TopicBreakdown topics={data.topics} showSubject={false} /></Card>
        <Card>
          <SectionTitle>Score distribution</SectionTitle>
          <div className="space-y-2.5">{data.distribution.map((d) => <div key={d.label} className="flex items-center gap-3 text-sm"><span className="w-20 shrink-0 text-[#5d6c62]">{d.label}</span><div className="h-6 flex-1 rounded bg-[#f1f4f1]"><div className="h-full rounded bg-[#7fb492]" style={{ width: `${(d.count / maxBucket) * 100}%` }} /></div><span className="w-6 text-right font-semibold">{d.count}</span></div>)}</div>
        </Card>
      </div>
      <Card padded={false}>
        <div className="px-5 pt-5"><SectionTitle>Students (latest attempt)</SectionTitle></div>
        <table className="w-full text-sm">
          <thead className="border-y border-[#edf1ee] text-left text-xs uppercase tracking-wide text-[#7d8981]"><tr><th className="px-5 py-2.5 font-medium">Student</th><th className="px-5 py-2.5 font-medium">Score</th><th className="hidden px-5 py-2.5 font-medium sm:table-cell">Tries</th><th className="hidden px-5 py-2.5 font-medium md:table-cell">Submitted</th><th /></tr></thead>
          <tbody className="divide-y divide-[#f0f3f0]">{data.students.map((s) => <tr key={s.attemptId}><td className="px-5 py-3"><span className="font-medium text-[#17221d]">{s.user.name}</span><span className="block text-xs text-[#8a958e]">{s.user.email}</span></td><td className="px-5 py-3"><div className="flex w-40 items-center gap-2"><ScoreBar value={s.percentage} /><span className="w-16 text-right font-semibold">{s.score}/{s.total}</span></div></td><td className="hidden px-5 py-3 sm:table-cell">{s.tries}</td><td className="hidden px-5 py-3 text-[#7d8981] md:table-cell">{formatDate(s.submittedAt, true)}</td><td className="px-5 py-3 text-right"><Link href={`/results/${s.attemptId}`} className="font-semibold text-[#2f6b45] hover:underline">Analysis</Link></td></tr>)}</tbody>
        </table>
      </Card>
      <Card>
        <SectionTitle>Question difficulty</SectionTitle>
        <ul className="divide-y divide-[#f0f3f0]">{data.questions.map((q) => <li key={q.id} className="flex items-center gap-4 py-2.5 text-sm"><span className="w-7 shrink-0 font-semibold text-[#7d8981]">Q{q.number}</span><span className="min-w-0 flex-1 truncate text-[#26332b]">{q.prompt}</span>{q.topic && <Badge>#{q.topic}</Badge>}<div className="flex w-36 shrink-0 items-center gap-2"><ScoreBar value={q.correctRate ?? 0} /><span className="w-10 text-right text-xs font-semibold">{q.correctRate ?? "–"}%</span></div></li>)}</ul>
      </Card>
    </div>
  );
}
