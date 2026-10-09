"use client";

import { BookOpen, ExternalLink, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { ClassSubjectFilters, ClassSubjectSelect, Pagination, TopicSelect, useClassSubjects } from "@/components/content/pickers";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge, EmptyState, ErrorNote, Loading, PageHeader, Tabs } from "@/components/ui/display";
import { TYPE_META } from "@/components/content/resource-meta";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RESOURCE_LABEL, formatDate } from "@/lib/format";
import { useApi, useDebounced, usePage } from "@/lib/use-api";
import type { Resource, ResourceType } from "@/types";


type ListResponse = { resources: Resource[]; total: number; page: number; pageSize: number; counts: Partial<Record<ResourceType, number>> };

export default function ResourcesPage() {
  const { can } = useAuth();
  const manage = can("resources.manage");
  const { options, reload: reloadOptions } = useClassSubjects();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | ResourceType>("");
  const [filters, setFilters] = useState({ classId: "", subjectId: "" });
  const search = useDebounced(q);
  const [page, setPage] = usePage(JSON.stringify([search, type, filters]));
  const list = useApi<ListResponse>(`/resources${qs({ q: search, type, ...filters, page })}`);
  const [editing, setEditing] = useState<Resource | "new" | null>(null);

  const counts = list.data?.counts ?? {};
  const all = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <>
      <PageHeader title="Resources" subtitle="Books, blogs, notes and links for the classes and subjects you can access." action={manage && <Button icon={Plus} onClick={() => setEditing("new")}>Add resource</Button>} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search title, author, topic, subject or text…" className="lg:max-w-md lg:flex-1" />
        <div className="flex flex-col gap-3 sm:flex-row"><ClassSubjectFilters options={options} classId={filters.classId} subjectId={filters.subjectId} onChange={setFilters} /></div>
      </div>
      <div className="mb-6">
        <Tabs value={type} onChange={setType} items={[{ value: "", label: `All ${all}` }, ...(Object.keys(TYPE_META) as ResourceType[]).map((t) => ({ value: t, label: `${TYPE_META[t].plural} ${counts[t] ?? 0}` }))]} />
      </div>

      {list.error ? <ErrorNote message={list.error} /> : list.loading && !list.data ? <Loading /> : !list.data?.resources.length ? (
        q || type || filters.classId ? <EmptyState icon={SearchX} title="Nothing matches" description="Try a different word or clear the filters." /> : <EmptyState icon={BookOpen} title="No resources yet" description={manage ? "Add the first book, blog or notes for your classes." : "Your teachers haven't added resources for your classes yet."} action={manage && <Button icon={Plus} onClick={() => setEditing("new")}>Add resource</Button>} />
      ) : (
        <>
          <p className="mb-3 text-sm text-[#66736c]">{list.data.total} result{list.data.total === 1 ? "" : "s"}{search && <> for “<span className="font-medium text-[#17221d]">{search}</span>”</>}</p>
          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${list.loading ? "opacity-60" : ""}`}>
            {list.data.resources.map((r) => <ResourceCard key={r.id} resource={r} manage={manage} onEdit={() => setEditing(r)} onDeleted={list.reload} />)}
          </div>
          <Pagination page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />
        </>
      )}

      {editing && <ResourceForm resource={editing === "new" ? null : editing} options={options} onTopicCreated={reloadOptions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}

function ResourceCard({ resource: r, manage, onEdit, onDeleted }: { resource: Resource; manage: boolean; onEdit: () => void; onDeleted: () => void }) {
  const meta = TYPE_META[r.type];
  const Icon = meta.icon;
  return (
    <div className="group flex flex-col rounded-xl border border-[#e2e8e3] bg-white p-5 transition hover:border-[#c7d3ca] hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${meta.iconClass}`}><Icon size={20} /></span>
        <div className="min-w-0 flex-1">
          <Link href={`/resources/${r.id}`} className="line-clamp-2 font-semibold leading-snug text-[#17221d] hover:underline">{r.title}</Link>
          {r.author && <p className="mt-0.5 truncate text-sm text-[#6b786f]">by {r.author}</p>}
        </div>
      </div>
      {r.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#5d6c62]">{r.description}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone={meta.tone}>{RESOURCE_LABEL[r.type]}</Badge>
        {r.classSubject ? <Badge>{r.classSubject.classGroup.name} · {r.classSubject.subject.name}</Badge> : <Badge tone="blue">Whole school</Badge>}
        {r.topic && <Badge tone="gray">#{r.topic.name}</Badge>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-[#8a958e]">
        <span>{formatDate(r.createdAt)}{r.createdBy && ` · ${r.createdBy.name}`}</span>
        <span className="flex gap-1.5">
          {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-[#2f6b45] hover:bg-[#eef4ef]"><ExternalLink size={13} />Open</a>}
          {manage && <button onClick={onEdit} aria-label="Edit" className="rounded-md p-1.5 text-[#66736c] hover:bg-[#f1f4f1]"><Pencil size={14} /></button>}
          {manage && <ConfirmButton icon={Trash2} label="" confirmLabel="Delete?" variant="ghost" onConfirm={async () => { try { await api(`/resources/${r.id}`, { method: "DELETE" }); toast.success("Deleted"); onDeleted(); } catch (e) { toast.error(errorMessage(e)); } }} />}
        </span>
      </div>
    </div>
  );
}

function ResourceForm({ resource, options, onClose, onSaved, onTopicCreated }: { resource: Resource | null; options: ReturnType<typeof useClassSubjects>["options"]; onClose: () => void; onSaved: () => void; onTopicCreated: () => void }) {
  const { me, can } = useAuth();
  const [form, setForm] = useState({
    title: resource?.title ?? "", type: resource?.type ?? ("BOOK" as ResourceType), author: resource?.author ?? "", description: resource?.description ?? "",
    url: resource?.url ?? "", classSubjectId: resource?.classSubject?.id ?? "", topicId: resource?.topic?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  // The list doesn't include the blog/notes body, so load it for editing.
  const full = useApi<{ resource: Resource }>(resource ? `/resources/${resource.id}` : null);
  const [content, setContent] = useState<string | null>(null);
  const contentValue = content ?? full.data?.resource.content ?? "";
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const option = options.find((o) => o.id === form.classSubjectId);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, author: form.author || null, description: form.description || null, url: form.url || null, content: contentValue || null, classSubjectId: form.classSubjectId || null, topicId: form.topicId || null };
      await api(resource ? `/resources/${resource.id}` : "/resources", { method: resource ? "PUT" : "POST", body });
      toast.success(resource ? "Resource updated" : "Resource added");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} wide title={resource ? "Edit resource" : "Add resource"} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="resource-form" type="submit" loading={saving}>{resource ? "Save" : "Add resource"}</Button></>}>
      <form id="resource-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><Input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. NCERT Science Class 2" /></Field>
        <Field label="Type"><Select value={form.type} onChange={(e) => set("type", e.target.value)}>{(Object.keys(RESOURCE_LABEL) as ResourceType[]).map((t) => <option key={t} value={t}>{RESOURCE_LABEL[t]}</option>)}</Select></Field>
        <Field label={form.type === "BLOG" ? "Writer" : "Author"}><Input value={form.author} onChange={(e) => set("author", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Class & subject" hint={me?.unrestricted ? "Leave empty to share with the whole school." : undefined}>
          <ClassSubjectSelect options={options} value={form.classSubjectId} onChange={(id) => setForm((f) => ({ ...f, classSubjectId: id, topicId: "" }))} noneLabel={me?.unrestricted ? "Whole school (no class)" : "Choose class & subject"} />
        </Field>
        <Field label="Topic" hint="Tagging a topic helps recommendations."><TopicSelect option={option} value={form.topicId} onChange={(id) => set("topicId", id)} canCreate={can("classes.manage", "papers.manage", "videos.manage")} onCreated={onTopicCreated} /></Field>
        <Field label="Link (PDF, website, drive…)" className="sm:col-span-2"><Input type="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Short description" className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="min-h-16" /></Field>
        {(form.type === "BLOG" || form.type === "NOTES") && <Field label={form.type === "BLOG" ? "Blog post" : "Notes"} className="sm:col-span-2" hint="Plain text. Blank lines start new paragraphs."><Textarea value={contentValue} onChange={(e) => setContent(e.target.value)} className="min-h-48" /></Field>}
      </form>
    </Modal>
  );
}
