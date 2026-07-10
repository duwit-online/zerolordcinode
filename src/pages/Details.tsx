import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bookmark, BookmarkCheck, Calendar, Clock3,
  Layers3, Sparkles, Star, Tv2, Users, Film, Globe, Play, Download, Loader2,
} from "lucide-react";
import { useMovieDetail, useTVDetail, useSeasonDetail, useSimilar, useCredits, useTrending, usePopularMovies, usePopularTV, useTopRatedMovies, useTopRatedTV } from "@/hooks/useTMDB";
import { getBackdropUrl, getImageUrl, getTitle, getYear, type TMDBDetail } from "@/lib/tmdb";
import { useAuth } from "@/contexts/AuthContext";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import TMDBRow from "@/components/TMDBRow";
import AdBanner from "@/components/AdBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { isNative } from "@/lib/native";
import { useOfflineDownload } from "@/hooks/useOfflineDownload";
import { useResolveSources } from "@/hooks/useResolveSources";
import GetTheAppModal from "@/components/GetTheAppModal";

const safeScore = (score?: number) => (typeof score === "number" ? score.toFixed(1) : "N/A");

const Details = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const mediaType = type === "tv" ? "tv" : "movie";
  const tmdbId = (id ?? "") as string;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialSeason = Number(searchParams.get("season") || 1);
  const initialEpisode = Number(searchParams.get("episode") || 1);

  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);

  useEffect(() => {
    if (mediaType !== "tv") return;
    setSeason(initialSeason || 1);
    setEpisode(initialEpisode || 1);
  }, [mediaType, tmdbId, initialSeason, initialEpisode]);

  useEffect(() => {
    if (mediaType !== "tv") return;
    const next = `?season=${season}&episode=${episode}`;
    if (location.search !== next) navigate({ pathname: location.pathname, search: next }, { replace: true });
  }, [mediaType, season, episode, location.pathname, location.search, navigate]);

  const { data: movieDetail, isLoading: movieLoading } = useMovieDetail(mediaType === "movie" ? tmdbId : "");
  const { data: tvDetail, isLoading: tvLoading } = useTVDetail(mediaType === "tv" ? tmdbId : "");
  const detail = mediaType === "movie" ? movieDetail : tvDetail;
  const isLoading = mediaType === "movie" ? movieLoading : tvLoading;
  const { data: seasonData } = useSeasonDetail(mediaType === "tv" ? tmdbId : "", season);
  const { data: similar } = useSimilar(mediaType, tmdbId);
  const { data: credits } = useCredits(mediaType, tmdbId);
  const { data: trending } = useTrending("week");
  const { data: popularMovies } = usePopularMovies();
  const { data: popularTV } = usePopularTV();
  const { data: topRatedMovies } = useTopRatedMovies();
  const { data: topRatedTV } = useTopRatedTV();

  const isInWatchlist = useIsInWatchlist(tmdbId, mediaType);
  const toggleWatchlist = useToggleWatchlist();

  const displayTitle = detail ? getTitle(detail as any) : "Untitled";
  const cast = credits?.cast?.slice(0, 12) || [];
  const director = credits?.crew?.find((c: any) => c.job === "Director");
  const producers = credits?.crew?.filter((c: any) => c.job === "Producer")?.slice(0, 3) || [];
  const writers = credits?.crew?.filter((c: any) => c.department === "Writing")?.slice(0, 3) || [];

  const handleToggleWatchlist = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to save to your watchlist." });
      return;
    }
    toggleWatchlist.mutate({ tmdbId, mediaType, title: displayTitle, posterPath: detail?.poster_path || "", isInList: isInWatchlist });
  };

  const setSeasonAndReset = (value: number) => { setSeason(value); setEpisode(1); };
  const setEpisodeAndReset = (value: number) => { setEpisode(value); };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-16 px-4">
        <Skeleton className="w-full aspect-video max-w-5xl mx-auto rounded-2xl" />
      </div>
    );
  }

  const spokenLanguages = (detail as any)?.spoken_languages;
  const originCountry = (detail as any)?.origin_country;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="relative w-full overflow-hidden" style={{ minHeight: "clamp(380px, 55vh, 620px)" }}>
        <img src={getBackdropUrl(detail?.backdrop_path || detail?.poster_path)} alt={displayTitle} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

        <div className="absolute top-4 left-4 z-20">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md px-3.5 py-2.5 text-white/90 hover:bg-black/70 transition-colors">
            <ArrowLeft size={18} />
            <span className="text-xs font-medium hidden sm:inline">Back</span>
          </button>
        </div>

        <div className="absolute top-4 right-4 z-20">
          <button onClick={handleToggleWatchlist} className="rounded-full bg-black/50 backdrop-blur-md p-2.5 text-white/90 hover:bg-black/70 transition-colors" aria-label="Toggle watchlist">
            {isInWatchlist ? <BookmarkCheck size={20} className="text-primary" /> : <Bookmark size={20} />}
          </button>
        </div>

        <div className="relative z-10 flex h-full items-end" style={{ minHeight: "clamp(380px, 55vh, 620px)" }}>
          <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 sm:pb-10">
            <div className="flex items-end gap-6">
              <img src={getImageUrl(detail?.poster_path, "w500")} alt={displayTitle} className="hidden w-36 rounded-2xl border-2 border-white/10 object-cover shadow-2xl sm:block lg:w-44" loading="lazy" />
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em]">
                  <span className="rounded-full bg-primary/25 px-3 py-1 font-black text-primary">{mediaType === "movie" ? "Movie" : "Series"}</span>
                  {detail?.status && <span className="rounded-full bg-white/15 px-3 py-1 font-semibold text-white/80">{detail.status}</span>}
                </div>

                <h1 className="max-w-3xl text-3xl font-black leading-[1.1] text-white sm:text-4xl lg:text-5xl drop-shadow-lg">{displayTitle}</h1>
                {detail?.tagline && <p className="max-w-xl text-sm italic text-primary/90 font-medium">{detail.tagline}</p>}

                <div className="flex flex-wrap gap-2.5 text-xs text-white font-semibold">
                  <span className="flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-sm px-3.5 py-2"><Star size={13} className="fill-yellow-400 text-yellow-400" /> {safeScore(detail?.vote_average)}</span>
                  <span className="flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-sm px-3.5 py-2"><Calendar size={13} className="text-primary" /> {getYear(detail as any) || "TBA"}</span>
                  <span className="flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-sm px-3.5 py-2"><Clock3 size={13} className="text-primary" />{detail?.runtime ? `${detail.runtime} min` : detail?.number_of_seasons ? `${detail.number_of_seasons} Seasons` : "—"}</span>
                  {director && <span className="flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-sm px-3.5 py-2"><Film size={13} className="text-accent" /> {director.name}</span>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {detail?.genres?.map((genre) => <span key={genre.id} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[11px] font-semibold text-white/90">{genre.name}</span>)}
                </div>

                <DetailActions
                  mediaType={mediaType}
                  tmdbId={tmdbId}
                  season={season}
                  episode={episode}
                  title={displayTitle}
                  posterPath={detail?.poster_path}
                  isInWatchlist={isInWatchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onPlay={() => {
                    const q = mediaType === "tv" ? `?season=${season}&episode=${episode}` : "";
                    navigate(`/watch/${mediaType}/${tmdbId}${q}`);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6">
        <AdBanner placement="watch_page" className="mb-2" />

        <div className="grid gap-5 lg:grid-cols-[1fr,1fr]">
          <div className="rounded-2xl border border-border/20 bg-card/80 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-base font-black text-primary"><Sparkles size={16} /> Storyline</div>
            <p className="text-sm leading-7 text-foreground/90">{detail?.overview || "No overview available yet."}</p>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card/80 p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-base font-black text-accent"><Layers3 size={16} /> Production Notes</div>
            <div className="grid gap-3 text-sm">
              {director && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Director</span><span className="font-bold">{director.name}</span></div>}
              {producers.length > 0 && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Producers</span><span className="font-bold">{producers.map((p: any) => p.name).join(", ")}</span></div>}
              {writers.length > 0 && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Writers</span><span className="font-bold">{writers.map((w: any) => w.name).join(", ")}</span></div>}
              {(detail as any)?.budget > 0 && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Budget</span><span className="font-bold">${((detail as any).budget / 1_000_000).toFixed(0)}M</span></div>}
              {(detail as any)?.revenue > 0 && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Revenue</span><span className="font-bold">${((detail as any).revenue / 1_000_000).toFixed(0)}M</span></div>}
              {spokenLanguages?.length > 0 && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Language</span><span className="font-bold">{spokenLanguages.map((l: any) => l.english_name).join(", ")}</span></div>}
              {originCountry?.length > 0 && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Country</span><span className="font-bold">{originCountry.join(", ")}</span></div>}
              {(detail as any)?.production_companies?.length > 0 && <div className="flex items-start gap-3"><span className="min-w-[80px] text-muted-foreground font-medium">Studios</span><div className="flex flex-wrap gap-1.5">{(detail as any).production_companies.slice(0, 5).map((company: any) => <span key={company.id} className="rounded-full bg-secondary/70 px-3 py-1 text-[11px] font-semibold">{company.name}</span>)}</div></div>}
            </div>
          </div>
        </div>

        {cast.length > 0 && (
          <div className="rounded-2xl border border-border/20 bg-card/80 p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-base font-black text-accent"><Users size={16} /> Cast Spotlight</div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {cast.map((person: any) => (
                <div key={person.id} className="w-[80px] flex-shrink-0 text-center">
                  <img src={person.profile_path ? getImageUrl(person.profile_path, "w185") : "/placeholder.svg"} alt={person.name} className="mx-auto h-[80px] w-[80px] rounded-full border-2 border-border/30 object-cover shadow-lg" loading="lazy" />
                  <p className="mt-2 line-clamp-1 text-[11px] font-bold">{person.name}</p>
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">{person.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {mediaType === "tv" && detail && (
          <div className="rounded-2xl border border-border/20 bg-card/80 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-base font-black text-primary"><Tv2 size={16} /> Episode Navigator</div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <select value={season} onChange={(e) => setSeasonAndReset(Number(e.target.value))} className="rounded-xl bg-secondary/70 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-border/40">
                {((detail as TMDBDetail).seasons || []).filter((s) => s.season_number > 0).map((s) => <option key={s.season_number} value={s.season_number}>{s.name}</option>)}
              </select>
              <select value={episode} onChange={(e) => setEpisodeAndReset(Number(e.target.value))} className="rounded-xl bg-secondary/70 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-border/40">
                {(seasonData?.episodes || []).map((ep) => <option key={ep.episode_number} value={ep.episode_number}>Episode {ep.episode_number}: {ep.name}</option>)}
              </select>
            </div>
            {seasonData?.episodes?.length ? (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {seasonData.episodes.map((ep) => (
                  <button key={ep.episode_number} onClick={() => setEpisodeAndReset(ep.episode_number)} className={`overflow-hidden rounded-xl border text-left transition-all ${episode === ep.episode_number ? "border-primary/40 bg-primary/10" : "border-border/20 bg-secondary/20 hover:bg-secondary/40"}`}>
                    {ep.still_path && <img src={getImageUrl(ep.still_path, "w500")} alt={ep.name} className="h-28 w-full object-cover" loading="lazy" />}
                    <div className="p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Episode {ep.episode_number}</p>
                      <h3 className="mt-0.5 text-xs font-bold">{ep.name}</h3>
                      <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{ep.overview || "No overview."}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-1">
        {similar?.results && similar.results.length > 0 && <TMDBRow title={mediaType === "movie" ? "Similar Movies" : "Similar Series"} items={similar.results} />}
        {trending?.results && <TMDBRow title="Trending Now" items={trending.results} />}
        {popularMovies?.results && <TMDBRow title="Popular Movies" items={popularMovies.results} />}
        {popularTV?.results && <TMDBRow title="Popular Series" items={popularTV.results} />}
        {topRatedMovies?.results && <TMDBRow title="Top Rated Movies" items={topRatedMovies.results} />}
        {topRatedTV?.results && <TMDBRow title="Top Rated Series" items={topRatedTV.results} />}
      </div>
    </div>
  );
};

interface ActionsProps {
  mediaType: "movie" | "tv"; tmdbId: number; season: number; episode: number;
  title: string; posterPath?: string; isInWatchlist: boolean;
  onToggleWatchlist: () => void; onPlay: () => void;
}
const DetailActions = ({ mediaType, tmdbId, season, episode, title, posterPath, isInWatchlist, onToggleWatchlist, onPlay }: ActionsProps) => {
  const [showAppModal, setShowAppModal] = useState(false);
  const native = isNative();
  const args = useMemo(() => ({ tmdbId, type: mediaType, season, episode }), [tmdbId, mediaType, season, episode]);
  const { sources } = useResolveSources(args);
  const { start, busy, progress } = useOfflineDownload();

  const handleDownload = async () => {
    if (!native) { setShowAppModal(true); return; }
    const direct = sources.find((s) => s.kind === "mp4") || sources.find((s) => s.kind === "hls");
    if (!direct) { toast({ title: "No downloadable source", description: "Only Jellyfin or override sources can be downloaded.", variant: "destructive" }); return; }
    await start({ url: direct.url, sourceLabel: direct.label, tmdbId, type: mediaType, season, episode, title, posterPath });
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 pt-2">
        <button onClick={onPlay} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-xl hover:bg-primary/90 transition">
          <Play size={16} className="fill-primary-foreground" /> Play Now
        </button>
        <button onClick={handleDownload} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-5 py-3 text-sm font-semibold text-white hover:bg-white/25 transition disabled:opacity-60">
          {busy ? <><Loader2 size={16} className="animate-spin" /> {progress}%</> : <><Download size={16} /> Download</>}
        </button>
        <button onClick={onToggleWatchlist} className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-5 py-3 text-sm font-semibold text-white hover:bg-white/25 transition">
          {isInWatchlist ? <BookmarkCheck size={16} className="text-primary" /> : <Bookmark size={16} />}
          {isInWatchlist ? "In Watchlist" : "My List"}
        </button>
      </div>
      <GetTheAppModal open={showAppModal} onClose={() => setShowAppModal(false)} />
    </>
  );
};

export default Details;
