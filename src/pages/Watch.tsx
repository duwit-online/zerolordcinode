import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, Loader2, RotateCw, X } from "lucide-react";
import CinodePlayer from "@/components/watch/CinodePlayer";
import { useResolveSources } from "@/hooks/useResolveSources";
import { useMovieDetail, useTVDetail, useSeasonDetail } from "@/hooks/useTMDB";
import { getBackdropUrl, getTitle } from "@/lib/tmdb";
import { getOfflineSrc, makeId } from "@/lib/offlineDownloads";
import { useResumeProgress, useSaveProgress } from "@/hooks/useWatchProgress";

const Watch = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mediaType = (type === "tv" ? "tv" : "movie") as "movie" | "tv";
  const tmdbId = Number(id);
  const season = Number(params.get("season") || 1);
  const episode = Number(params.get("episode") || 1);
  const offlineMode = params.get("offline") === "1";
  const [offlineSrc, setOfflineSrc] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!offlineMode) { setOfflineSrc(null); return; }
    (async () => { setOfflineSrc(await getOfflineSrc(makeId(tmdbId, mediaType, season, episode))); })();
  }, [offlineMode, tmdbId, mediaType, season, episode]);

  const { data: movie } = useMovieDetail(mediaType === "movie" ? tmdbId : 0);
  const { data: tv } = useTVDetail(mediaType === "tv" ? tmdbId : 0);
  const { data: seasonData } = useSeasonDetail(mediaType === "tv" ? tmdbId : 0, season);
  const detail = mediaType === "movie" ? movie : tv;

  const args = useMemo(() => ({ tmdbId, type: mediaType, season, episode }), [tmdbId, mediaType, season, episode]);
  const { sources, loading } = useResolveSources(args);

  const progressKey = useMemo(() => ({ tmdbId, mediaType, season: mediaType === "tv" ? season : null, episode: mediaType === "tv" ? episode : null }), [tmdbId, mediaType, season, episode]);
  const { data: resume } = useResumeProgress(progressKey);
  const saveProgress = useSaveProgress(progressKey);

  const setSE = (s: number, e: number) => { const p = new URLSearchParams(params); p.set("season", String(s)); p.set("episode", String(e)); setParams(p, { replace: true }); };

  const title = detail ? getTitle(detail as any) : "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-foreground">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
        >
          <X size={20} />
        </button>
        <h1 className="pointer-events-none flex-1 truncate px-3 text-center font-display text-xl italic sm:text-2xl">
          {title}
        </h1>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          aria-label="Reload player"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
        >
          <RotateCw size={18} />
        </button>
      </div>

      {/* Player area */}
      <div className="relative flex flex-1 items-center justify-center">
        {loading && !offlineSrc ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-24 w-24 rounded-full bg-white/[0.03]">
              <Loader2 className="absolute inset-0 m-auto animate-spin text-primary" size={40} />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
              Optimizing Stream
            </p>
          </div>
        ) : (
          <div className="h-full w-full">
            <CinodePlayer
              key={reloadKey}
              sources={sources}
              forcedSrc={offlineSrc}
              poster={getBackdropUrl(detail?.backdrop_path)}
              initialTime={resume?.playback_time || 0}
              onTimeUpdate={(t, d) => saveProgress(t, d)}
            />
          </div>
        )}
      </div>

      {/* TV season/episode drawer */}
      {mediaType === "tv" && tv && (
        <div className="relative z-10 max-h-[38vh] overflow-y-auto border-t border-white/5 bg-black/80 px-4 py-4 backdrop-blur-md">
          <div className="mx-auto max-w-4xl space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Season</label>
              <div className="relative">
                <select
                  value={season}
                  onChange={(e) => setSE(Number(e.target.value), 1)}
                  className="appearance-none rounded-full border border-white/10 bg-white/5 pl-4 pr-9 py-1.5 text-xs font-semibold text-white"
                >
                  {Array.from({ length: tv.number_of_seasons || 1 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s} className="bg-black">Season {s}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            {seasonData?.episodes && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {seasonData.episodes.map((ep: any) => {
                  const active = ep.episode_number === episode;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => setSE(season, ep.episode_number)}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-all ${active ? "border-primary bg-primary/15" : "border-white/10 bg-white/5 hover:border-primary/50"}`}
                    >
                      <div className="text-[10px] font-bold uppercase text-primary">EP {ep.episode_number}</div>
                      <div className="max-w-[160px] truncate text-xs font-semibold">{ep.name || `Episode ${ep.episode_number}`}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Watch;
