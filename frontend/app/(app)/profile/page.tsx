"use client";

import { KeyRound, Save } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/display";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AUDIENCE_LABEL } from "@/lib/format";

export default function ProfilePage() {
  const { me, refresh } = useAuth();
  const [name, setName] = useState(me?.name ?? "");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState<"name" | "pw" | null>(null);
  if (!me) return null;

  async function update(kind: "name" | "pw") {
    setBusy(kind);
    try {
      await api("/me", { method: "PATCH", body: kind === "name" ? { name } : pw });
      toast.success(kind === "name" ? "Name updated" : "Password changed");
      if (kind === "pw") setPw({ currentPassword: "", newPassword: "" });
      await refresh();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My profile" />
      <Card className="mb-5">
        <SectionTitle>Account</SectionTitle>
        <p className="mb-4 text-sm text-[#5d6c62]">{me.email}{me.role && <> · <Badge tone="green">{me.role.name}</Badge> <Badge>{AUDIENCE_LABEL[me.role.audience]}</Badge></>}</p>
        <form onSubmit={(e) => { e.preventDefault(); void update("name"); }} className="flex items-end gap-2">
          <Field label="Display name" className="flex-1"><Input value={name} minLength={2} onChange={(e) => setName(e.target.value)} /></Field>
          <Button icon={Save} loading={busy === "name"} disabled={name === me.name}>Save</Button>
        </form>
      </Card>
      <Card>
        <SectionTitle>Change password</SectionTitle>
        <form onSubmit={(e) => { e.preventDefault(); void update("pw"); }} className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password"><Input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password"><Input type="password" required minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Button icon={KeyRound} loading={busy === "pw"}>Change password</Button></div>
        </form>
      </Card>
    </div>
  );
}
