import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { useContinueWatching } from "@/hooks/useWatchProgress";
import { getImageUrl } from "@/lib/tmdb";

const fetchTMDB = async (mediaType: string, tmdbId: number) => {
  const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=2d93ebba01c3a81f04f9c86874d25143`);
  if (!res.ok) return null;
  return res.json();
};

const ContinueWatchingRow = () => {
  const navigate = useNavigate();
  const { data: progress } = useContinueWatching();

  const queries = useQueries({
    queries: (progress || []).map((p: any) => ({
      queryKey: ["tmdb-meta", p.media_type, p.tmdb_id],
      queryFn: () => fetchTMDB(p.media_type, p.tmdb_id),
      staleTime: 1000 * 60 * 60,
    })),
  });

  if (!progress?.length) return null;

  const handleClick = (p: any) => {
    const url = p.media_type === "tv"
      ? `/watch/tv/${p.tmdb_id}?season=${p.season || 1}&episode=${p.episode || 1}`
      : `/watch/movie/${p.tmdb_id}`;
    navigate(url);
  };

  return (
    <section className="py-4">
      <div className="flex items-center justify-between mb-3 px-4 md:px-12">
        <h2 className="text-lg font-display font-bold">▶️ Continue Watching</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2">
        {progress.map((p: any, i: number) => {
          const meta = queries[i]?.data;
          const poster = meta?.poster_path ? getImageUrl(meta.poster_path) : "/placeholder.svg";
          const title = meta?.title || meta?.name || "Loading…";
          const pct = p.duration ? Math.min(100, (p.playback_time / p.duration) * 100) : 0;
          return (
            <button
              key={`${p.media_type}-${p.tmdb_id}-${p.season}-${p.episode}`}
              onClick={() => handleClick(p)}
              className="group relative flex-shrink-0 w-[150px] h-[225px] rounded-2xl overflow-hidden bg-card text-left"
            >
              <img src={poster} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
                  <Play size={16} className="fill-primary-foreground text-primary-foreground ml-0.5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <h3 className="text-xs font-bold line-clamp-1 mb-1">{title}</h3>
                {p.media_type === "tv" && (
                  <p className="text-[10px] text-muted-foreground mb-1">S{p.season} · E{p.episode}</p>
                )}
                <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ContinueWatchingRow;
