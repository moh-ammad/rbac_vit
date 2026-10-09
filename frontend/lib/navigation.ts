import { BookOpen, ClipboardList, GraduationCap, LayoutDashboard, Megaphone, PlayCircle, School, Settings, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Pages exist in code; WHO sees them is decided by the permissions on the
// user's role (from the database). A page shows when the user has ANY of
// its permissions. Dashboard is for every active user.
export type NavItem = { label: string; href: string; icon: LucideIcon; anyOf: string[] };

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, anyOf: [] },
  { label: "Classes", href: "/classes", icon: GraduationCap, anyOf: ["classes.view"] },
  { label: "Resources", href: "/resources", icon: BookOpen, anyOf: ["resources.view"] },
  { label: "Videos", href: "/videos", icon: PlayCircle, anyOf: ["videos.view"] },
  { label: "Question Papers", href: "/question-papers", icon: ClipboardList, anyOf: ["papers.view", "papers.manage", "papers.attempt", "results.view"] },
  { label: "Instructions", href: "/instructions", icon: Megaphone, anyOf: ["instructions.view", "instructions.manage"] },
  { label: "School", href: "/school", icon: School, anyOf: ["school.view", "school.manage"] },
  { label: "Users", href: "/users", icon: Users, anyOf: ["users.view", "users.manage"] },
  { label: "Settings", href: "/settings", icon: Settings, anyOf: ["roles.manage"] },
];

/** Which nav item a path belongs to (for active state + access checks). */
export function navItemFor(pathname: string) {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

// Extra routes that belong to a section without being in the nav.
export const ROUTE_PERMISSIONS: { prefix: string; anyOf: string[] }[] = [
  { prefix: "/results", anyOf: ["papers.attempt", "results.view"] },
];
