import { BookOpen, FileText, Link2, Newspaper, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/display";
import type { ResourceType } from "@/types";

export const TYPE_META: Record<ResourceType, { icon: LucideIcon; tone: Tone; plural: string; iconClass: string }> = {
  BOOK: { icon: BookOpen, tone: "green", plural: "Books", iconClass: "bg-[#e3f0e6] text-[#2f6b45]" },
  BLOG: { icon: Newspaper, tone: "violet", plural: "Blogs", iconClass: "bg-[#eee8f8] text-[#5b3f91]" },
  NOTES: { icon: FileText, tone: "amber", plural: "Notes", iconClass: "bg-[#fbf0d9] text-[#8a5a12]" },
  LINK: { icon: Link2, tone: "blue", plural: "Links", iconClass: "bg-[#e5eef9] text-[#2f5d91]" },
};
