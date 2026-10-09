"use client";

import { Pencil, PlayCircle, Plus, SearchX, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ClassSubjectFilters, ClassSubjectSelect, Pagination, TopicSelect, useClassSubjects } from "@/components/content/pickers";
import { PlayerModal, VideoThumb } from "@/components/content/video-player";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge, EmptyState, ErrorNote, Loading, PageHeader } from "@/components/ui/display";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { useApi, useDebounced, usePage } from "@/lib/use-api";
import type { ClassSubjectOption, Video } from "@/types";

export default function VideosPage() {
  const { can } = useAuth();
  const manage = can("videos.manage");
  const { options, reload: reloadOptions } = useClassSubjects();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ classId: "", subjectId: "" });
  const [topicId, setTopicId] = useState("");
  const search = useDebounced(q);
  const [page, setPage] = usePage(JSON.stringify([search, filters, topicId]));
  const list = useApi<{ videos: Video[]; total: number; pageSize: number }>(`/videos${qs({ q: search, ...filters, topicId, page })}`);
  const [playing, setPlaying] = useState<Video | null>(null);
  const [editing, setEditing] = useState<Video | "new" | null>(null);

  const topics = useMemo(() => options.filter((o) => (!filters.classId || o.class.id === filters.classId) && (!filters.subjectId || o.subject.id === filters.subjectId)).flatMap((o) => o.topics.map((t) => ({ ...t, label: `${t.name} (${o.subject.name}, ${o.class.name})` }))), [options, filters]);

  return (
    <>
      <PageHeader title="Videos" subtitle="Video lessons tagged by class, subject and topic. Students get these recommended when a test shows a weak topic." action={manage && <Button icon={Plus} onClick={() => setEditing("new")}>Add video</Button>} />
      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Search videos, topics or subjects…" className="lg:max-w-md lg:flex-1" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <ClassSubjectFilters options={options} classId={filters.classId} subjectId={filters.subjectId} onChange={(f) => { setFilters(f); setTopicId(""); }} />
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="sm:w-56" aria-label="Topic"><option value="">All topics</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select>
        </div>
      </div>

      {list.error ? <ErrorNote message={list.error} /> : list.loading && !list.data ? <Loading /> : !list.data?.videos.length ? (
        q || filters.classId || topicId ? <EmptyState icon={SearchX} title="No videos match" /> : <EmptyState icon={PlayCircle} title="No videos yet" description={manage ? "Paste a YouTube link and tag it with a topic." : "Videos for your classes will appear here."} action={manage && <Button icon={Plus} onClick={() => setEditing("new")}>Add video</Button>} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {list.data.videos.map((v) => (
              <div key={v.id} className="flex flex-col overflow-hidden rounded-xl border border-[#e2e8e3] bg-white">
                <VideoThumb url={v.url} title={v.title} onPlay={() => setPlaying(v)} className="rounded-none" />
                <div className="flex flex-1 flex-col p-4">
                  <button onClick={() => setPlaying(v)} className="line-clamp-2 text-left font-semibold leading-snug text-[#17221d] hover:underline">{v.title}</button>
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge>{v.classSubject.classGroup.name} · {v.classSubject.subject.name}</Badge>{v.topic && <Badge tone="green">#{v.topic.name}</Badge>}</div>
                  <div className="mt-auto flex items-center justify-between pt-3 text-xs text-[#8a958e]">
                    <span>{formatDate(v.createdAt)}</span>
                    {manage && <span className="flex gap-1"><button onClick={() => setEditing(v)} aria-label="Edit" className="rounded-md p-1.5 hover:bg-[#f1f4f1]"><Pencil size={14} /></button><ConfirmButton icon={Trash2} label="" confirmLabel="Delete?" variant="ghost" onConfirm={async () => { try { await api(`/videos/${v.id}`, { method: "DELETE" }); toast.success("Deleted"); list.reload(); } catch (e) { toast.error(errorMessage(e)); } }} /></span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />
        </>
      )}
      <PlayerModal video={playing} onClose={() => setPlaying(null)} />
      {editing && <VideoForm video={editing === "new" ? null : editing} options={options} onTopicCreated={reloadOptions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}

function VideoForm({ video, options, onClose, onSaved, onTopicCreated }: { video: Video | null; options: ClassSubjectOption[]; onClose: () => void; onSaved: () => void; onTopicCreated: () => void }) {
  const [form, setForm] = useState({ title: video?.title ?? "", url: video?.url ?? "", description: video?.description ?? "", classSubjectId: video?.classSubject.id ?? "", topicId: video?.topic?.id ?? "" });
  const [saving, setSaving] = useState(false);
  const option = options.find((o) => o.id === form.classSubjectId);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(video ? `/videos/${video.id}` : "/videos", { method: video ? "PUT" : "POST", body: { ...form, description: form.description || null, topicId: form.topicId || null } });
      toast.success(video ? "Video updated" : "Video added");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={video ? "Edit video" : "Add video"} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="video-form" type="submit" loading={saving}>{video ? "Save" : "Add video"}</Button></>}>
      <form id="video-form" onSubmit={save} className="space-y-4">
        <Field label="Title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Video link" hint="YouTube links play inside the app. Other links open in a new tab."><Input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></Field>
        <Field label="Class & subject"><ClassSubjectSelect options={options} value={form.classSubjectId} onChange={(id) => setForm({ ...form, classSubjectId: id, topicId: "" })} /></Field>
        <Field label="Topic" hint="Students who score low on this topic will be recommended this video."><TopicSelect option={option} value={form.topicId} onChange={(id) => setForm({ ...form, topicId: id })} canCreate onCreated={onTopicCreated} /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" /></Field>
      </form>
    </Modal>
  );
}
