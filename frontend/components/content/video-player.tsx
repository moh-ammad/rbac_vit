"use client";

import { ExternalLink, PlayCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { youtubeId } from "@/lib/format";

export function VideoThumb({ url, title, onPlay, className = "" }: { url: string; title: string; onPlay: () => void; className?: string }) {
  const id = youtubeId(url);
  return (
    <button type="button" onClick={onPlay} aria-label={`Play ${title}`} className={`group relative block aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-[#294536] to-[#17221d] ${className}`}>
      {id && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 size-full object-cover opacity-90 transition group-hover:scale-[1.03]" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      )}
      <span className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/25"><PlayCircle size={46} strokeWidth={1.5} className="text-white drop-shadow" /></span>
    </button>
  );
}

export function PlayerModal({ video, onClose }: { video: { title: string; url: string; description?: string | null } | null; onClose: () => void }) {
  if (!video) return null;
  const id = youtubeId(video.url);
  return (
    <Modal open onClose={onClose} wide title={video.title} description={video.description ?? undefined}>
      {id ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <div className="rounded-lg bg-[#f4f6f4] p-6 text-center text-sm text-[#5d6c62]">
          This video is hosted outside YouTube.
          <a href={video.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 font-semibold text-[#2f6b45] hover:underline"><ExternalLink size={15} />Open video</a>
        </div>
      )}
    </Modal>
  );
}
