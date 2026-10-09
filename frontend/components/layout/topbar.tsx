"use client";

import { ChevronDown, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/display";
import { useAuth } from "@/lib/auth-context";
import { AUDIENCE_LABEL } from "@/lib/format";
import { NAV_ITEMS, navItemFor } from "@/lib/navigation";

export function Topbar({ schoolName }: { schoolName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, can, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const links = NAV_ITEMS.filter((item) => item.anyOf.length === 0 || can(...item.anyOf));
  const active = navItemFor(pathname)?.href;

  useEffect(() => {
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!me) return null;
  const initial = me.name.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-[#e0e7e1] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-[#17221d] text-sm font-bold text-white">{(schoolName ?? "LMS").charAt(0)}</span>
          <span className="hidden max-w-36 truncate text-[17px] font-bold tracking-tight text-[#17221d] sm:block">{schoolName ?? "LMS"}</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 xl:flex">
          {links.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${active === href ? "bg-[#17221d] text-white" : "text-[#5f6d64] hover:bg-[#f1f4f1] hover:text-[#17221d]"}`}>
              <Icon size={15} />{label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => router.push("/search")} aria-label="Search" className="rounded-lg p-2 text-[#5f6d64] hover:bg-[#f1f4f1]"><Search size={18} /></button>
          <div ref={menuRef} className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-[#f1f4f1]" aria-label="Account menu">
              <span className="grid size-8 place-items-center rounded-full bg-[#dce9dd] text-sm font-semibold text-[#365341]">{initial}</span>
              <span className="hidden text-left leading-tight md:block"><span className="block max-w-32 truncate text-[13px] font-semibold text-[#17221d]">{me.name}</span><span className="block max-w-32 truncate text-[11px] text-[#7d8981]">{me.role?.name ?? "No role yet"}</span></span>
              <ChevronDown size={14} className="hidden text-[#7d8981] md:block" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-[#e0e7e1] bg-white shadow-xl">
                <div className="border-b border-[#eef2ee] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-[#17221d]">{me.name}</p>
                  <p className="truncate text-xs text-[#7d8981]">{me.email}</p>
                  {me.role && <div className="mt-2 flex gap-1.5"><Badge tone="green">{me.role.name}</Badge><Badge>{AUDIENCE_LABEL[me.role.audience]}</Badge></div>}
                </div>
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#34433a] hover:bg-[#f6f8f6]"><UserRound size={16} />My profile</Link>
                <button onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50"><LogOut size={16} />Sign out</button>
              </div>
            )}
          </div>
          <button onClick={() => setMobileOpen((v) => !v)} className="rounded-lg p-2 text-[#5f6d64] hover:bg-[#f1f4f1] xl:hidden" aria-label="Toggle navigation">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="grid gap-1 border-t border-[#e0e7e1] bg-white p-3 xl:hidden">
          {links.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active === href ? "bg-[#17221d] text-white" : "text-[#5f6d64] hover:bg-[#f1f4f1]"}`}><Icon size={17} />{label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
