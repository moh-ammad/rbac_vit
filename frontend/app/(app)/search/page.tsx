"use client";

import { BookOpen, ClipboardList, GraduationCap, PlayCircle, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, EmptyState, Loading, PageHeader, SectionTitle } from "@/components/ui/display";
import { SearchInput } from "@/components/ui/form";
import { qs } from "@/lib/api";
import { RESOURCE_LABEL } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";
import type { ClassSubjectLabel, ResourceType } from "@/types";

type Results = {
  classes: { id: string; name: string }[];
  resources: { id: string; title: string; type: ResourceType; classSubject: ClassSubjectLabel | null }[];
  videos: { id: string; title: string; classSubject: ClassSubjectLabel }[];
  papers: { id: string; title: string; classSubject: ClassSubjectLabel }[];
  users: { id: string; name: string; email: string; role: { name: string } | null }[];
};

export default function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const search = useDebounced(q);
  useEffect(() => { router.replace(`/search${qs({ q: search })}`, { scroll: false }); }, [search, router]);
  const { data, loading } = useApi<{ results: Results }>(search.length >= 2 ? `/search${qs({ q: search })}` : null);
  const r = data?.results;
  const total = r ? r.classes.length + r.resources.length + r.videos.length + r.papers.length + r.users.length : 0;
  const label = (cs: ClassSubjectLabel | null) => (cs ? `${cs.classGroup.name} · ${cs.subject.name}` : "Whole school");

  const groups: { title: string; icon: typeof BookOpen; items: { key: string; href: string; title: string; sub: string }[] }[] = r ? [
    { title: "Classes", icon: GraduationCap, items: r.classes.map((c) => ({ key: c.id, href: `/classes/${c.id}`, title: c.name, sub: "Class" })) },
    { title: "Resources", icon: BookOpen, items: r.resources.map((x) => ({ key: x.id, href: `/resources/${x.id}`, title: x.title, sub: `${RESOURCE_LABEL[x.type]} · ${label(x.classSubject)}` })) },
    { title: "Videos", icon: PlayCircle, items: r.videos.map((x) => ({ key: x.id, href: `/videos`, title: x.title, sub: label(x.classSubject) })) },
    { title: "Question papers", icon: ClipboardList, items: r.papers.map((x) => ({ key: x.id, href: `/question-papers/${x.id}`, title: x.title, sub: label(x.classSubject) })) },
    { title: "People", icon: UserRound, items: r.users.map((x) => ({ key: x.id, href: `/users`, title: x.name, sub: `${x.email}${x.role ? ` · ${x.role.name}` : ""}` })) },
  ].filter((g) => g.items.length) : [];

  return (
    <>
      <PageHeader title="Search" subtitle="Searches only what your role can see." />
      <SearchInput value={q} onChange={setQ} placeholder="Search classes, resources, videos, papers…" className="mb-6 max-w-2xl" />
      {search.length < 2 ? <EmptyState icon={Search} title="Type at least two letters" /> : loading ? <Loading label="Searching" /> : total === 0 ? <EmptyState icon={Search} title={`Nothing found for “${search}”`} /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.title}>
              <SectionTitle><span className="flex items-center gap-2"><g.icon size={15} />{g.title}</span></SectionTitle>
              <ul className="space-y-1">{g.items.map((i) => <li key={i.key}><Link href={i.href} className="block rounded-lg px-2 py-2 hover:bg-[#f6f8f6]"><span className="block text-sm font-medium text-[#17221d]">{i.title}</span><span className="block text-xs text-[#7d8981]">{i.sub}</span></Link></li>)}</ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
