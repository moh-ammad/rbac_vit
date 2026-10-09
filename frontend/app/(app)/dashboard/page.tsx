"use client";

import { AlertTriangle, BarChart3, BookOpen, ClipboardList, Clock, GraduationCap, Megaphone, PlayCircle, Target, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Insights, RecommendationList, TopicBreakdown, TrendChart } from "@/components/analysis/analysis";
import { TYPE_META } from "@/components/content/resource-meta";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, ErrorNote, Loading, ScoreBar, SectionTitle, StatCard } from "@/components/ui/display";
import { useAuth } from "@/lib/auth-context";
import { AUDIENCE_LABEL, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { ClassSubjectLabel, ResourceType, StudentAnalysis } from "@/types";

type DashboardData = {
  stats: Partial<Record<"classes" | "subjects" | "resources" | "videos" | "papers" | "users" | "pendingUsers", number>>;
  instructions: { id: string; title: string; body: string; isPinned: boolean; createdAt: string; classGroup: { name: string } | null }[];
  latestResources: { id: string; title: string; type: ResourceType; classSubject: ClassSubjectLabel | null }[];
  latestVideos: { id: string; title: string; classSubject: ClassSubjectLabel; topic: { name: string } | null }[];
  student: { pendingTests: { id: string; title: string; durationMinutes: number | null; classSubject: ClassSubjectLabel; _count: { questions: number } }[]; analysis: StudentAnalysis } | null;
  recentAttempts: { id: string; percentage: number; submittedAt: string; user: { name: string }; paper: { id: string; title: string; classSubject: ClassSubjectLabel } }[] | null;
};

const STAT_META = [
  { key: "classes", label: "Classes", icon: GraduationCap, tone: "green", href: "/classes" },
  { key: "subjects", label: "Subjects", icon: BookOpen, tone: "blue", href: "/classes" },
  { key: "resources", label: "Resources", icon: BookOpen, tone: "violet", href: "/resources" },
  { key: "videos", label: "Videos", icon: PlayCircle, tone: "red", href: "/videos" },
  { key: "papers", label: "Question papers", icon: ClipboardList, tone: "amber", href: "/question-papers" },
  { key: "users", label: "Users", icon: Users, tone: "blue", href: "/users" },
] as const;

export default function DashboardPage() {
  const { me } = useAuth();
  const { data, error, loading } = useApi<DashboardData>("/dashboard");
  if (loading) return <Loading />;
  if (error || !data || !me) return <ErrorNote message={error ?? "Could not load dashboard"} />;
  const firstName = me.name.split(" ")[0];
  const stats = STAT_META.filter((s) => data.stats[s.key] !== undefined);
  const a = data.student?.analysis;

  return (
    <>
      <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#17221d]">Hello, {firstName}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[#66736c]">
            {me.role && <><Badge tone="green">{me.role.name}</Badge><Badge>{AUDIENCE_LABEL[me.role.audience]}</Badge></>}
            <span>{me.unrestricted ? "Access to every class" : `Access to ${me.classIds?.length ?? 0} class${me.classIds?.length === 1 ? "" : "es"} · ${me.classSubjectIds?.length ?? 0} subjects`}</span>
          </p>
        </div>
      </div>

      {(data.stats.pendingUsers ?? 0) > 0 && (
        <Link href="/users?status=PENDING" className="mb-6 flex items-center gap-3 rounded-xl border border-[#f0d9a8] bg-[#fffaf0] px-5 py-3.5 text-sm text-[#6b4a10] hover:bg-[#fff5e0]">
          <UserPlus size={18} /><span><b>{data.stats.pendingUsers}</b> new sign-up{data.stats.pendingUsers === 1 ? " is" : "s are"} waiting for a role.</span><span className="ml-auto font-semibold">Assign roles →</span>
        </Link>
      )}

      {a && (
        <div className="mb-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <SectionTitle action={<Link href="/question-papers" className="text-xs font-semibold text-[#2f6b45] hover:underline">All tests</Link>}>My performance</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Average score" value={a.summary.averagePercentage === null ? "–" : `${a.summary.averagePercentage}%`} />
              <Metric label="Tests taken" value={a.summary.testsTaken} />
              <Metric label="Weak topics" value={a.summary.weakTopics} warn={a.summary.weakTopics > 0} />
            </div>
            {a.insights.length > 0 && <div className="mt-5 rounded-lg bg-[#f6f8f6] p-4"><Insights lines={a.insights} /></div>}
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.08em] text-[#7d8981]">Score trend</p><TrendChart points={a.trend} /></div>
              <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.08em] text-[#7d8981]">By subject</p>{a.subjects.length ? <ul className="space-y-3">{a.subjects.map((s) => <li key={s.classSubjectId}><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-[#17221d]">{s.subject}</span><span className="text-[#5d6c62]">{s.percentage}%</span></div><ScoreBar value={s.percentage} /></li>)}</ul> : <p className="text-sm text-[#7d8981]">No tests yet.</p>}</div>
            </div>
          </Card>
          <div className="space-y-6">
            <Card>
              <SectionTitle>Recommended for you</SectionTitle>
              {a.recommendations.length ? <RecommendationList items={a.recommendations} /> : <p className="text-sm text-[#7d8981]">{a.summary.testsTaken ? "No weak topics right now — nice work." : "Take a test and we'll suggest videos for the topics you find hard."}</p>}
            </Card>
            <Card>
              <SectionTitle>Tests waiting for you</SectionTitle>
              {data.student!.pendingTests.length ? (
                <ul className="space-y-2">{data.student!.pendingTests.map((t) => <li key={t.id} className="flex items-center gap-3 rounded-lg border border-[#edf1ee] p-3"><span className="grid size-9 place-items-center rounded-lg bg-[#fbf0d9] text-[#8a5a12]"><ClipboardList size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#17221d]">{t.title}</span><span className="block text-xs text-[#7d8981]">{t.classSubject.subject.name} · {t._count.questions} questions{t.durationMinutes ? ` · ${t.durationMinutes} min` : ""}</span></span><ButtonLink href={`/question-papers/${t.id}/take`} size="sm">Start</ButtonLink></li>)}</ul>
              ) : <p className="text-sm text-[#7d8981]">You&apos;re all caught up.</p>}
            </Card>
          </div>
        </div>
      )}

      {a && a.topics.length > 0 && <Card className="mb-6"><SectionTitle>Topic strengths & weaknesses</SectionTitle><TopicBreakdown topics={a.topics} /></Card>}

      {stats.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {stats.map((s) => <Link key={s.key} href={s.href}><StatCard icon={s.icon} label={s.label} value={data.stats[s.key] ?? 0} tone={s.tone} /></Link>)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {data.recentAttempts && (
          <Card>
            <SectionTitle>Latest test submissions</SectionTitle>
            {data.recentAttempts.length ? <ul className="space-y-1">{data.recentAttempts.map((t) => <li key={t.id}><Link href={`/results/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#f6f8f6]"><BarChart3 size={16} className="text-[#6b786f]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#17221d]">{t.user.name} · {t.paper.title}</span><span className="block text-xs text-[#8a958e]">{t.paper.classSubject.classGroup.name} · {timeAgo(t.submittedAt)}</span></span><Badge tone={t.percentage < 60 ? "red" : t.percentage < 80 ? "amber" : "green"}>{Math.round(t.percentage)}%</Badge></Link></li>)}</ul> : <p className="text-sm text-[#7d8981]">No submissions yet.</p>}
          </Card>
        )}
        {data.instructions.length > 0 && (
          <Card>
            <SectionTitle action={<Link href="/instructions" className="text-xs font-semibold text-[#2f6b45] hover:underline">All</Link>}>Instructions</SectionTitle>
            <ul className="space-y-3">{data.instructions.map((i) => <li key={i.id} className="rounded-lg border border-[#edf1ee] p-3"><div className="flex items-center gap-2"><Megaphone size={14} className="text-[#4a6654]" /><span className="truncate text-sm font-semibold text-[#17221d]">{i.title}</span>{i.isPinned && <Badge tone="green">Pinned</Badge>}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#66736c]">{i.body}</p><p className="mt-1 text-[11px] text-[#9aa59d]">{i.classGroup?.name ?? "Whole school"} · {timeAgo(i.createdAt)}</p></li>)}</ul>
          </Card>
        )}
        {data.latestResources.length > 0 && (
          <Card>
            <SectionTitle action={<Link href="/resources" className="text-xs font-semibold text-[#2f6b45] hover:underline">All</Link>}>New resources</SectionTitle>
            <ul className="space-y-1">{data.latestResources.map((r) => { const M = TYPE_META[r.type]; return <li key={r.id}><Link href={`/resources/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#f6f8f6]"><span className={`grid size-8 place-items-center rounded-lg ${M.iconClass}`}><M.icon size={15} /></span><span className="min-w-0"><span className="block truncate text-sm font-medium text-[#17221d]">{r.title}</span><span className="block text-xs text-[#8a958e]">{r.classSubject ? `${r.classSubject.classGroup.name} · ${r.classSubject.subject.name}` : "Whole school"}</span></span></Link></li>; })}</ul>
          </Card>
        )}
        {data.latestVideos.length > 0 && !a && (
          <Card>
            <SectionTitle action={<Link href="/videos" className="text-xs font-semibold text-[#2f6b45] hover:underline">All</Link>}>New videos</SectionTitle>
            <ul className="space-y-1">{data.latestVideos.map((v) => <li key={v.id}><Link href="/videos" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#f6f8f6]"><span className="grid size-8 place-items-center rounded-lg bg-[#fbe5e3] text-[#a33a2f]"><PlayCircle size={15} /></span><span className="min-w-0"><span className="block truncate text-sm font-medium text-[#17221d]">{v.title}</span><span className="block text-xs text-[#8a958e]">{v.classSubject.subject.name}{v.topic ? ` · #${v.topic.name}` : ""}</span></span></Link></li>)}</ul>
          </Card>
        )}
      </div>

      {stats.length === 0 && !a && !data.instructions.length && (
        <Card className="text-center"><Clock className="mx-auto text-[#9aa59d]" /><p className="mt-3 text-sm text-[#66736c]">Your role doesn&apos;t include any pages yet. Ask an administrator to add permissions in Settings.</p></Card>
      )}
    </>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-[#edf1ee] p-4">
      <p className="flex items-center gap-1.5 text-xs text-[#7d8981]">{warn ? <AlertTriangle size={12} className="text-[#c0473b]" /> : <Target size={12} />}{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? "text-[#a33a2f]" : "text-[#17221d]"}`}>{value}</p>
    </div>
  );
}
