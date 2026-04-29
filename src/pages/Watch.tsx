import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import CinodePlayer from "@/components/watch/CinodePlayer";
import { useResolveSources } from "@/hooks/useResolveSources";
import { useMovieDetail, useTVDetail, useSeasonDetail } from "@/hooks/useTMDB";
import { getBackdropUrl, getTitle } from "@/lib/tmdb";
import { getOfflineSrc, makeId } from "@/lib/offlineDownloads";

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

  const setSE = (s: number, e: number) => { const p = new URLSearchParams(params); p.set("season", String(s)); p.set("episode", String(e)); setParams(p, { replace: true }); };

  return (
    <div className="min-h-screen bg-background pt-16 pb-24 md:pb-12 px-3 md:px-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={16} /> Back
        </button>

        {loading && !offlineSrc ? (
          <div className="aspect-video w-full bg-black/60 rounded-2xl flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={36} />
          </div>
        ) : (
          <CinodePlayer sources={sources} forcedSrc={offlineSrc} poster={getBackdropUrl(detail?.backdrop_path)} />
        )}

        <h1 className="mt-5 text-2xl md:text-3xl font-black">{detail ? getTitle(detail as any) : "Loading…"}</h1>
        {detail?.overview && <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{detail.overview}</p>}

        {mediaType === "tv" && tv && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold">Season</label>
              <div className="relative">
                <select value={season} onChange={(e) => setSE(Number(e.target.value), 1)}
                  className="appearance-none rounded-xl border border-border bg-card pl-3 pr-9 py-2 text-sm font-medium">
                  {Array.from({ length: tv.number_of_seasons || 1 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>Season {s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            {seasonData?.episodes && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {seasonData.episodes.map((ep: any) => {
                  const active = ep.episode_number === episode;
                  return (
                    <button key={ep.id} onClick={() => setSE(season, ep.episode_number)}
                      className={`text-left rounded-xl border px-3 py-2 transition-all ${active ? "border-primary bg-primary/15" : "border-border bg-card/60 hover:border-primary/50"}`}>
                      <div className="text-[11px] uppercase font-bold text-primary">EP {ep.episode_number}</div>
                      <div className="text-sm font-semibold line-clamp-1">{ep.name || `Episode ${ep.episode_number}`}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Watch;
