"use client";

import { Lightbulb, PlayCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { PlayerModal, VideoThumb } from "@/components/content/video-player";
import { Badge, ScoreBar, levelTone } from "@/components/ui/display";
import { formatDate } from "@/lib/format";
import type { Recommendation, TopicStat } from "@/types";

const LEVEL_LABEL = { weak: "Needs work", average: "Getting there", strong: "Strong" } as const;

export function ScoreRing({ value, size = 132 }: { value: number; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = value < 60 ? "#d0574a" : value < 80 ? "#d99a2b" : "#3d8b5a";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#edf1ee" strokeWidth="12" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-[#17221d] text-[26px] font-semibold">{value}%</text>
    </svg>
  );
}

export function TopicBreakdown({ topics, showSubject = true }: { topics: TopicStat[]; showSubject?: boolean }) {
  if (!topics.length) return <p className="py-4 text-sm text-[#7d8981]">No answers yet.</p>;
  return (
    <ul className="space-y-3.5">
      {topics.map((t) => (
        <li key={t.key}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate"><span className="font-medium text-[#17221d]">{t.topic}</span>{showSubject && <span className="text-[#8a958e]"> · {t.subject}, {t.className}</span>}</span>
            <span className="flex shrink-0 items-center gap-2"><span className="text-xs text-[#7d8981]">{t.correct}/{t.total} correct</span><Badge tone={levelTone(t.level)}>{Math.round(t.accuracy * 100)}% · {LEVEL_LABEL[t.level]}</Badge></span>
          </div>
          <ScoreBar value={t.accuracy * 100} level={t.level} />
        </li>
      ))}
    </ul>
  );
}

export function Recommendations({ items, empty }: { items: Recommendation[]; empty?: string }) {
  const [playing, setPlaying] = useState<Recommendation["video"] | null>(null);
  if (!items.length) {
    return <div className="flex items-center gap-3 rounded-lg bg-[#f2f8f3] px-4 py-3 text-sm text-[#2f6b45]"><Sparkles size={16} />{empty ?? "No weak topics — nothing to catch up on right now."}</div>;
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((rec) => (
          <div key={rec.video.id} className="overflow-hidden rounded-xl border border-[#e2e8e3] bg-white">
            <VideoThumb url={rec.video.url} title={rec.video.title} onPlay={() => setPlaying(rec.video)} className="rounded-none" />
            <div className="p-4">
              <button onClick={() => setPlaying(rec.video)} className="line-clamp-2 text-left font-semibold leading-snug text-[#17221d] hover:underline">{rec.video.title}</button>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[#a33a2f]"><Lightbulb size={13} className="mt-0.5 shrink-0" />{rec.reason}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5"><Badge>{rec.video.classSubject.subject.name}</Badge>{rec.video.topic && <Badge tone="green">#{rec.video.topic.name}</Badge>}{rec.match === "subject" && <Badge tone="amber">related</Badge>}</div>
            </div>
          </div>
        ))}
      </div>
      <PlayerModal video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

export function RecommendationList({ items }: { items: Recommendation[] }) {
  const [playing, setPlaying] = useState<Recommendation["video"] | null>(null);
  return (
    <>
      <ul className="space-y-2">
        {items.slice(0, 4).map((rec) => (
          <li key={rec.video.id}>
            <button onClick={() => setPlaying(rec.video)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[#f6f8f6]">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fbe5e3] text-[#a33a2f]"><PlayCircle size={18} /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#17221d]">{rec.video.title}</span><span className="block truncate text-xs text-[#a33a2f]">{rec.reason}</span></span>
            </button>
          </li>
        ))}
      </ul>
      <PlayerModal video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

/** Simple bar chart of test scores over time. */
export function TrendChart({ points }: { points: { paper: string; percentage: number; submittedAt: string }[] }) {
  if (points.length < 2) return <p className="py-6 text-center text-sm text-[#7d8981]">Take a couple of tests to see your trend.</p>;
  const last = points.slice(-12);
  return (
    <div>
      <div className="flex h-40 items-end gap-2 border-b border-l border-[#e2e8e3] px-2 pb-0.5">
        {last.map((p, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="mb-1 text-center text-[10px] font-semibold text-[#5d6c62]">{p.percentage}</span>
            <div className={`w-full rounded-t ${p.percentage < 60 ? "bg-[#e39b92]" : p.percentage < 80 ? "bg-[#e8c27a]" : "bg-[#7fb492]"}`} style={{ height: `${Math.max(3, p.percentage)}%` }} />
            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#17221d] px-2 py-1 text-[11px] text-white group-hover:block">{p.paper} · {formatDate(p.submittedAt)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#8a958e]">Last {last.length} tests, oldest → newest</p>
    </div>
  );
}

export function Insights({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return <ul className="space-y-2">{lines.map((line) => <li key={line} className="flex gap-2 text-sm leading-6 text-[#34433a]"><Sparkles size={15} className="mt-1 shrink-0 text-[#4a6654]" />{line}</li>)}</ul>;
}
