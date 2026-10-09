"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Card, ErrorNote, Loading } from "@/components/ui/display";
import { RESOURCE_LABEL, formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Resource } from "@/types";

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<{ resource: Resource }>(`/resources/${id}`);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote message={error ?? "Not found"} />;
  const r = data.resource;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/resources" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#4a6654] hover:underline"><ArrowLeft size={15} />All resources</Link>
      <Card className="p-8">
        <div className="flex flex-wrap gap-1.5"><Badge tone="green">{RESOURCE_LABEL[r.type]}</Badge>{r.classSubject ? <Badge>{r.classSubject.classGroup.name} · {r.classSubject.subject.name}</Badge> : <Badge tone="blue">Whole school</Badge>}{r.topic && <Badge>#{r.topic.name}</Badge>}</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#17221d]">{r.title}</h1>
        <p className="mt-2 text-sm text-[#7d8981]">{r.author && <>by <span className="font-medium text-[#34433a]">{r.author}</span> · </>}{formatDate(r.createdAt)}{r.createdBy && <> · added by {r.createdBy.name}</>}</p>
        {r.description && <p className="mt-6 text-lg leading-8 text-[#4c5a51]">{r.description}</p>}
        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-[#17221d] px-4 text-sm font-semibold text-white hover:bg-[#2c4235]"><ExternalLink size={16} />Open resource</a>}
        {r.content && <article className="mt-8 space-y-4 border-t border-[#eef2ee] pt-8 text-[15px] leading-7 text-[#26332b]">{r.content.split(/\n\s*\n/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}</article>}
      </Card>
    </div>
  );
}
