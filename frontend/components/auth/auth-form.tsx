"use client";

import { Eye, EyeOff, LoaderCircle, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { api, errorMessage } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const isRegister = mode === "register";
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      // The API answers with an httpOnly session cookie — nothing to store here.
      await api(`/auth/${mode}`, { method: "POST", body: isRegister ? form : { email: form.email, password: form.password } });
      toast.success(isRegister ? "Account created" : "Welcome back");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {isRegister && <AuthField icon={User} label="Full name"><input required minLength={2} value={form.name} onChange={set("name")} placeholder="Your name" className={inputClass} /></AuthField>}
      <AuthField icon={Mail} label="Email"><input required type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@school.com" className={inputClass} /></AuthField>
      <AuthField icon={Lock} label="Password">
        <div className="relative">
          <input required minLength={isRegister ? 6 : undefined} type={show ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={set("password")} placeholder={isRegister ? "At least 6 characters" : "Enter your password"} className={`${inputClass} pr-11`} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a958e]" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
      </AuthField>
      <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#17221d] text-sm font-semibold text-white hover:bg-[#334d3b] disabled:opacity-60">
        {loading && <LoaderCircle size={17} className="animate-spin" />}{isRegister ? "Create account" : "Sign in"}
      </button>
      {isRegister && <p className="text-xs leading-5 text-[#7d8981]">New accounts start without a role. Your school administrator will assign one before you can see classes and content.</p>}
    </form>
  );
}

const inputClass = "h-12 w-full rounded-lg border border-[#d9e2db] bg-[#fbfcfb] px-4 text-sm text-[#17221d] outline-none placeholder:text-[#a0aaa3] focus:border-[#6c8872] focus:ring-2 focus:ring-[#dce9dd]";

function AuthField({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#34433a]">{label}</span><div className="relative"><Icon size={17} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#8a958e]" /><div className="pl-9">{children}</div></div></label>;
}

export function AuthPage({ title, eyebrow, description, formTitle, mode, footer }: { title: string; eyebrow: string; description: string; formTitle: string; mode: "login" | "register"; footer: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#294536] p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,#9fbaa2_0,transparent_28%),linear-gradient(145deg,#294536,#17221d)] opacity-90" />
        <Link href="/" className="relative flex items-center gap-3 text-xl font-bold tracking-tight text-white"><span className="grid size-9 place-items-center rounded-lg bg-white text-sm text-[#17221d]">L</span>LMS</Link>
        <div className="relative max-w-lg pb-12 text-white"><p className="mb-5 text-sm font-semibold uppercase tracking-[.18em] text-[#c4d9c6]">{eyebrow}</p><h1 className="text-5xl font-semibold leading-tight tracking-[-.03em]">{title}</h1><p className="mt-5 max-w-md text-lg leading-8 text-[#d0dfd2]">{description}</p></div>
        <p className="relative text-xs text-[#b5cdb8]">A calmer operating system for school life.</p>
      </div>
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-12 flex items-center gap-3 text-xl font-bold tracking-tight lg:hidden"><span className="grid size-9 place-items-center rounded-lg bg-[#17221d] text-sm text-white">L</span>LMS</Link>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#68816f]">{formTitle}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#17221d]">{title}</h2>
          <AuthForm mode={mode} />
          <p className="mt-6 text-center text-sm text-[#758079]">{footer}</p>
        </div>
      </div>
    </div>
  );
}
