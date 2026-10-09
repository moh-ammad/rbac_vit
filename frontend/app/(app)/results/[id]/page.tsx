"use client";

import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Recommendations, ScoreRing, TopicBreakdown } from "@/components/analysis/analysis";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, ErrorNote, Loading, SectionTitle } from "@/components/ui/display";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { ClassSubjectLabel, Recommendation, TopicStat } from "@/types";

type ResultData = {
  attempt: { id: string; score: number; total: number; percentage: number; submittedAt: string; startedAt: string | null; userId: string; user: { name: string }; paper: { id: string; title: string; classSubject: ClassSubjectLabel } };
  review: { number: number; id: string; prompt: string; options: string[]; correctIndex: number; marks: number; explanation: string | null; topic: { name: string } | null; selectedIndex: number | null; isCorrect: boolean }[];
  topics: TopicStat[];
  recommendations: Recommendation[];
};

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const { data, error, loading } = useApi<ResultData>(`/attempts/${id}`);
  if (loading) return <Loading label="Analysing your answers" />;
  if (error || !data) return <ErrorNote message={error ?? "Result not found"} />;
  const { attempt, review, topics, recommendations } = data;
  const own = attempt.userId === me?.id;
  const weak = topics.filter((t) => t.level === "weak");
  const strong = topics.filter((t) => t.level === "strong");
  const minutes = attempt.startedAt ? Math.max(1, Math.round((new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000)) : null;

  return (
    <div className="space-y-6">
      <Link href="/question-papers" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4a6654] hover:underline"><ArrowLeft size={15} />Question papers</Link>
      <Card className="flex flex-col gap-6 p-7 md:flex-row md:items-center">
        <ScoreRing value={attempt.percentage} />
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#68816f]">{own ? "Your result" : `${attempt.user.name}'s result`}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#17221d]">{attempt.paper.title}</h1>
          <p className="mt-1 text-sm text-[#66736c]">{attempt.paper.classSubject.classGroup.name} · {attempt.paper.classSubject.subject.name} · submitted {formatDate(attempt.submittedAt, true)}{minutes ? ` · took ${minutes} min` : ""}</p>
          <p className="mt-4 text-[15px] leading-7 text-[#34433a]">
            Scored <b>{attempt.score} of {attempt.total}</b> marks.{" "}
            {weak.length ? <>Focus on <b>{weak.map((w) => w.topic).join(", ")}</b> — {recommendations.length ? "we picked videos for that below." : "ask your teacher for material on it."}</> : "No weak topics in this test — well done!"}
            {strong.length > 0 && <> Strong in <b>{strong.map((s) => s.topic).join(", ")}</b>.</>}
          </p>
        </div>
        {own && <ButtonLink href={`/question-papers/${attempt.paper.id}/take`} variant="secondary" icon={RotateCcw}>Retake</ButtonLink>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card><SectionTitle>Topic analysis</SectionTitle><TopicBreakdown topics={topics} showSubject={false} /><p className="mt-4 text-xs leading-5 text-[#8a958e]">Below 60% = needs work · 60–79% = getting there · 80%+ = strong. Calculated from marks on questions tagged with each topic.</p></Card>
        <div><SectionTitle>Recommended videos</SectionTitle><Recommendations items={recommendations} /></div>
      </div>

      <Card>
        <SectionTitle>Answer review</SectionTitle>
        <ol className="space-y-4">
          {review.map((q) => (
            <li key={q.id} className="rounded-xl border border-[#edf1ee] p-4">
              <div className="flex items-start gap-3">
                {q.isCorrect ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2f6b45]" /> : <XCircle size={20} className="mt-0.5 shrink-0 text-[#c0473b]" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[#17221d]">{q.number}. {q.prompt}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{q.topic && <Badge>#{q.topic.name}</Badge>}<Badge>{q.marks} mark{q.marks === 1 ? "" : "s"}</Badge></div>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, i) => {
                      const correct = i === q.correctIndex;
                      const picked = i === q.selectedIndex;
                      return <li key={i} className={`rounded-lg px-3 py-2 text-sm ${correct ? "bg-[#e3f0e6] font-medium text-[#1f5634]" : picked ? "bg-[#fbe5e3] text-[#8e2f25] line-through" : "bg-[#f6f8f6] text-[#5d6c62]"}`}>{String.fromCharCode(65 + i)}. {opt}{picked && " ← your answer"}</li>;
                    })}
                  </ul>
                  {q.selectedIndex === null && <p className="mt-2 text-xs text-[#a33a2f]">Not answered</p>}
                  {q.explanation && <p className="mt-3 rounded-lg bg-[#f6f8f6] px-3 py-2 text-sm leading-6 text-[#4c5a51]"><b>Why:</b> {q.explanation}</p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
