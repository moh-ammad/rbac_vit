"use client";

import { Clock3, LoaderCircle, LogOut, ShieldOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ROUTE_PERMISSIONS, navItemFor } from "@/lib/navigation";
import { useApi } from "@/lib/use-api";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AuthProvider><Guard>{children}</Guard></AuthProvider>;
}

function Guard({ children }: { children: React.ReactNode }) {
  const { me, loading, can, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const active = Boolean(me && me.status === "ACTIVE" && me.role && (me.role.isActive || me.isSuperAdmin));
  const school = useApi<{ school: { name: string } | null }>(active ? "/school/profile" : null);

  // Page-level access: the nav item (or extra route) must be allowed.
  const item = navItemFor(pathname);
  const extra = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix));
  const required = item?.anyOf ?? extra?.anyOf ?? [];
  const allowed = required.length === 0 || can(...required);

  useEffect(() => {
    if (active && !allowed) router.replace("/dashboard");
  }, [active, allowed, router]);

  if (loading || !me) return <div className="grid min-h-screen place-items-center bg-[#f7f8f6]"><LoaderCircle className="animate-spin text-[#4a6654]" /></div>;

  if (!active) {
    const suspended = me.status === "SUSPENDED";
    const roleOff = me.role && !me.role.isActive;
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f6] px-6">
        <div className="max-w-md rounded-2xl border border-[#e0e7e1] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-[#edf2ed] text-[#4a6654]">{suspended ? <ShieldOff /> : <Clock3 />}</div>
          <h1 className="text-xl font-semibold text-[#17221d]">{suspended ? "Account suspended" : roleOff ? "Your role is turned off" : `Welcome, ${me.name}`}</h1>
          <p className="mt-2 text-sm leading-6 text-[#66736c]">
            {suspended ? "Please contact your school administrator." : roleOff ? "An administrator has disabled your role. You will get access again once it is turned back on." : "Your account was created and is waiting for an administrator to assign you a role. Once that happens you will see your classes, resources and tests here."}
          </p>
          <Button variant="secondary" icon={LogOut} className="mt-6" onClick={logout}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <Topbar schoolName={school.data?.school?.name} />
      <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9">{allowed ? children : null}</main>
    </div>
  );
}

