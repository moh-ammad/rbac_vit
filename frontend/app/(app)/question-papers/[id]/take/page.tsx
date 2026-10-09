"use client";

import { ArrowLeft, ArrowRight, Clock, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, ErrorNote, Loading } from "@/components/ui/display";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { ClassSubjectLabel, Question } from "@/types";

type PaperForTest = { id: string; title: string; description: string | null; durationMinutes: number | null; classSubject: ClassSubjectLabel; questions: Question[]; totalMarks: number };

export default function TakeTestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading } = useApi<{ paper: PaperForTest }>(`/papers/${id}`);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startedMs] = useState(() => Date.now());
  const startedAt = new Date(startedMs).toISOString();
  const [now, setNow] = useState(startedMs);
  const submitted = useRef(false);
  const paper = data?.paper;
  // Timer is derived from a fixed deadline, so it can't drift.
  const deadline = paper?.durationMinutes ? startedMs + paper.durationMinutes * 60_000 : null;
  const secondsLeft = deadline === null ? null : Math.max(0, Math.round((deadline - now) / 1000));

  const submit = useCallback(async () => {
    if (!paper || submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const body = { startedAt, answers: paper.questions.map((q) => ({ questionId: q.id, selectedIndex: answers[q.id] ?? null })) };
      const { attempt } = await api<{ attempt: { id: string } }>(`/papers/${paper.id}/attempts`, { method: "POST", body });
      toast.success("Submitted! Here is your analysis.");
      router.replace(`/results/${attempt.id}`);
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      toast.error(errorMessage(e));
    }
  }, [paper, answers, startedAt, router]);

  // Keep the latest submit() for the timer callback.
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });

  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= deadline) {
        clearInterval(timer);
        toast("Time is up — submitting your answers");
        void submitRef.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (loading) return <Loading label="Loading test" />;
  if (error || !paper) return <ErrorNote message={error ?? "Test not found"} />;
  const q = paper.questions[current];
  const answered = Object.keys(answers).length;
  if (!q) return <ErrorNote message="This test has no questions." />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight text-[#17221d]">{paper.title}</h1><p className="text-sm text-[#6b786f]">{paper.classSubject.classGroup.name} · {paper.classSubject.subject.name} · {paper.totalMarks} marks</p></div>
        {secondsLeft !== null && <div className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-lg font-semibold ${secondsLeft < 60 ? "bg-[#fbe5e3] text-[#a33a2f]" : "bg-white text-[#17221d] ring-1 ring-[#e0e7e1]"}`}><Clock size={18} />{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</div>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <Card className="p-7">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#7d8981]">Question {current + 1} of {paper.questions.length} · {q.marks} mark{q.marks === 1 ? "" : "s"}</p>
          <h2 className="mt-3 text-lg font-medium leading-7 text-[#17221d]">{q.prompt}</h2>
          <div className="mt-6 space-y-2.5">
            {q.options.map((opt, idx) => {
              const chosen = answers[q.id] === idx;
              return (
                <button key={idx} onClick={() => setAnswers({ ...answers, [q.id]: idx })} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition ${chosen ? "border-[#2f6b45] bg-[#f2f8f3] ring-1 ring-[#2f6b45]" : "border-[#e0e7e1] hover:border-[#b9c6bc] hover:bg-[#fafbfa]"}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${chosen ? "bg-[#2f6b45] text-white" : "bg-[#eef2ee] text-[#5d6c62]"}`}>{String.fromCharCode(65 + idx)}</span>{opt}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-between">
            <Button variant="secondary" icon={ArrowLeft} disabled={current === 0} onClick={() => setCurrent(current - 1)}>Previous</Button>
            {current < paper.questions.length - 1 ? <Button onClick={() => setCurrent(current + 1)}>Next <ArrowRight size={16} /></Button> : <Button icon={Send} onClick={() => setConfirming(true)}>Finish</Button>}
          </div>
        </Card>

        <Card className="h-fit">
          <p className="text-sm font-semibold text-[#17221d]">{answered} of {paper.questions.length} answered</p>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {paper.questions.map((qq, i) => <button key={qq.id} onClick={() => setCurrent(i)} className={`aspect-square rounded-md text-xs font-semibold ${i === current ? "ring-2 ring-[#17221d]" : ""} ${answers[qq.id] !== undefined ? "bg-[#2f6b45] text-white" : "bg-[#eef2ee] text-[#5d6c62]"}`}>{i + 1}</button>)}
          </div>
          {confirming ? (
            <div className="mt-5 rounded-lg bg-[#fbf0d9] p-3 text-sm text-[#6b4a10]">
              {answered < paper.questions.length ? `${paper.questions.length - answered} unanswered question(s) will count as wrong.` : "Ready to submit?"}
              <div className="mt-3 flex gap-2"><Button size="sm" loading={submitting} onClick={submit}>Submit</Button><Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Keep going</Button></div>
            </div>
          ) : <Button className="mt-5 w-full" icon={Send} onClick={() => setConfirming(true)}>Submit test</Button>}
        </Card>
      </div>
    </div>
  );
}
