import type { Audience, ResourceType } from "@/types";

export function formatDate(value: string | Date, withTime = false) {
  const date = new Date(value);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
}

export function timeAgo(value: string | Date) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** YouTube id from watch / youtu.be / embed / shorts links, else null. */
export function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const match = u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/);
      return match?.[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export const AUDIENCE_LABEL: Record<Audience, string> = { STAFF: "Staff", TEACHER: "Teacher", STUDENT: "Student" };

export const AUDIENCE_HINT: Record<Audience, string> = {
  STAFF: "Principal, office or coordinators. Not listed as a class teacher.",
  TEACHER: "Listed as a teacher of the classes & subjects you tick.",
  STUDENT: "Listed as a student of the classes you tick. Can take tests.",
};

export const RESOURCE_LABEL: Record<ResourceType, string> = { BOOK: "Book", BLOG: "Blog", NOTES: "Notes", LINK: "Link" };

export const pct = (value: number) => `${Math.round(value * 100)}%`;
