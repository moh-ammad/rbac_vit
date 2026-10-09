"use client";

import { BookMarked, BookOpen, ClipboardList, Globe, GraduationCap, Mail, MapPin, Pencil, Phone, PlayCircle, School, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorNote, Loading, PageHeader, SectionTitle, StatCard } from "@/components/ui/display";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AUDIENCE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Audience } from "@/types";

type SchoolProfile = { id: string; name: string; address: string | null; phone: string | null; email: string | null; website: string | null; about: string | null; academicYear: string | null };
type SchoolData = {
  school: SchoolProfile | null;
  stats: { classes: number; subjects: number; resources: number; videos: number; papers: number; attempts: number; averageScore: number | null; users: Record<string, number>; people: Record<Audience, number> };
  roles: { id: string; name: string; audience: Audience; isActive: boolean; isSuperAdmin: boolean; members: number }[];
};

export default function SchoolPage() {
  const { can } = useAuth();
  const manage = can("school.manage");
  const { data, error, loading, reload } = useApi<SchoolData>("/school");
  const [editing, setEditing] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote message={error ?? "Could not load"} />;
  const s = data.school;
  const st = data.stats;

  return (
    <>
      <PageHeader title="School" subtitle="Profile and school-wide numbers." action={manage && <Button icon={Pencil} variant={s ? "secondary" : "primary"} onClick={() => setEditing(true)}>{s ? "Edit profile" : "Set up profile"}</Button>} />
      {s ? (
        <Card className="mb-6 p-7">
          <div className="flex flex-col gap-6 md:flex-row">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#17221d] text-2xl font-bold text-white">{s.name.charAt(0)}</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold tracking-tight text-[#17221d]">{s.name}</h2>{s.academicYear && <Badge tone="green">{s.academicYear}</Badge>}</div>
              {s.about && <p className="mt-2 max-w-3xl leading-7 text-[#4c5a51]">{s.about}</p>}
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#5d6c62]">
                {s.address && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{s.address}</span>}
                {s.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{s.phone}</span>}
                {s.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{s.email}</span>}
                {s.website && <a href={s.website.startsWith("http") ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#2f6b45] hover:underline"><Globe size={14} />{s.website}</a>}
              </div>
            </div>
          </div>
        </Card>
      ) : <div className="mb-6"><EmptyState icon={School} title="School profile not set up" description={manage ? "Add your school's name, address and academic year. The name also appears in the top bar." : "An administrator hasn't filled in the school profile yet."} /></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Classes" value={st.classes} hint={`${st.subjects} subjects`} />
        <StatCard icon={Users} label="Teachers" value={st.people.TEACHER ?? 0} tone="blue" hint={`${st.people.STAFF ?? 0} staff`} />
        <StatCard icon={Users} label="Students" value={st.people.STUDENT ?? 0} tone="violet" hint={`${st.users.PENDING ?? 0} waiting for a role`} />
        <StatCard icon={ClipboardList} label="Tests taken" value={st.attempts} tone="amber" hint={st.averageScore !== null ? `average ${st.averageScore}%` : "no tests yet"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <SectionTitle>Content library</SectionTitle>
          <ul className="space-y-3 text-sm">
            {[[BookOpen, "Resources", st.resources, "/resources"], [PlayCircle, "Videos", st.videos, "/videos"], [ClipboardList, "Question papers", st.papers, "/question-papers"], [BookMarked, "Subjects", st.subjects, "/classes"]].map(([Icon, label, value, href]) => {
              const I = Icon as typeof BookOpen;
              return <li key={label as string}><Link href={href as string} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#f6f8f6]"><span className="flex items-center gap-2.5 text-[#34433a]"><I size={16} className="text-[#4a6654]" />{label as string}</span><span className="font-semibold text-[#17221d]">{value as number}</span></Link></li>;
            })}
          </ul>
        </Card>
        <Card>
          <SectionTitle action={can("roles.manage") && <Link href="/settings" className="text-xs font-semibold text-[#2f6b45] hover:underline">Manage roles</Link>}>Roles in this school</SectionTitle>
          <ul className="divide-y divide-[#f0f3f0]">
            {data.roles.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <ShieldCheck size={16} className="text-[#6b786f]" />
                <span className="flex-1 text-sm font-medium text-[#17221d]">{r.name}</span>
                {!r.isActive && <Badge tone="amber">off</Badge>}
                <Badge>{r.isSuperAdmin ? "Admin" : AUDIENCE_LABEL[r.audience]}</Badge>
                <span className="w-16 text-right text-sm text-[#5d6c62]">{r.members} {r.members === 1 ? "person" : "people"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {editing && <SchoolForm school={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}

function SchoolForm({ school, onClose, onSaved }: { school: SchoolProfile | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: school?.name ?? "", academicYear: school?.academicYear ?? "", address: school?.address ?? "", phone: school?.phone ?? "", email: school?.email ?? "", website: school?.website ?? "", about: school?.about ?? "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/school", { method: "PUT", body: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null])) });
      toast.success("School profile saved");
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} wide title="School profile" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="school-form" type="submit" loading={saving}>Save</Button></>}>
      <form id="school-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="School name"><Input required value={form.name} onChange={set("name")} /></Field>
        <Field label="Academic year"><Input value={form.academicYear} onChange={set("academicYear")} placeholder="2026–27" /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={set("address")} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Website" className="sm:col-span-2"><Input value={form.website} onChange={set("website")} /></Field>
        <Field label="About" className="sm:col-span-2"><Textarea value={form.about} onChange={set("about")} /></Field>
      </form>
    </Modal>
  );
}
