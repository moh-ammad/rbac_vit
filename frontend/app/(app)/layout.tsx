import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

// Everything inside (app) needs a signed-in user. AppShell loads /api/me,
// shows the pending screen for users without a role, and hides pages the
// user's role does not allow. Suspense lets client pages read URL params.
// Pages render only after the signed-in user is known, so instant-navigation
// validation does not apply to this segment.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f7f8f6]"><LoaderCircle className="animate-spin text-[#4a6654]" /></div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
