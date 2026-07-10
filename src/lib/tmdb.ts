// Jellyfin-backed data layer. Preserves the TMDB-shaped API surface the UI uses.
// All Jellyfin URLs, API keys, and admin credentials live only inside the
// `jellyfin-api` edge function — never in this file, never in the browser.
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1/jellyfin-api`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
  return {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    Authorization: `Bearer ${token}`,
  };
}

async function api<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${FN_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const r = await fetch(url.toString(), { headers: await authHeaders() });
  if (!r.ok) throw new Error(`Jellyfin API ${path} -> ${r.status}`);
  return r.json();
}

// ---- image helpers (public proxy; no api key ever leaks) ----
export const getImageUrl = (pathOrToken: string | null, size: string = "w500") => {
  if (!pathOrToken) return "/placeholder.svg";
  // pathOrToken format: "<jfItemId>?type=Primary&tag=<hash>"
  const [id, query = ""] = pathOrToken.split("?");
  const q = new URLSearchParams(query);
  q.set("size", size);
  return `${FN_BASE}/image/${id}?${q.toString()}`;
};
export const getBackdropUrl = (pathOrToken: string | null) => getImageUrl(pathOrToken, "w1280");

// ---- types (kept compatible with existing UI imports) ----
export interface TMDBMovie {
  id: string;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: (number | string)[];
  media_type?: string;
}
export interface TMDBResponse { results: TMDBMovie[]; total_pages: number; total_results: number; page: number; }
export interface TMDBGenre { id: number | string; name: string; }
export interface TMDBSeason {
  id: string; season_number: number; name: string; episode_count: number; poster_path: string | null;
}
export interface TMDBEpisode {
  id: string; episode_number: number; name: string; overview: string; still_path: string | null;
  vote_average: number; air_date: string;
}
export interface TMDBSeasonDetail { episodes: TMDBEpisode[]; }
export interface TMDBDetail extends TMDBMovie {
  runtime?: number; number_of_seasons?: number; number_of_episodes?: number;
  genres: { id: number | string; name: string }[]; tagline?: string; status?: string;
  imdb_id?: string; seasons?: TMDBSeason[]; external_ids?: { imdb_id?: string };
  credits?: { cast: any[]; crew: any[] };
}

// ---- catalog endpoints (Jellyfin-backed, TMDB-shaped) ----
export const getTrending = (_timeWindow: "day" | "week" = "week") =>
  api<TMDBResponse>("/items", { sort: "PlayCount,DateCreated", order: "Descending", limit: 30 });

export const getPopularMovies = (page = 1) =>
  api<TMDBResponse>("/items", { type: "movie", sort: "PlayCount,CommunityRating", order: "Descending", page, limit: 30 });

export const getTopRatedMovies = (page = 1) =>
  api<TMDBResponse>("/items", { type: "movie", sort: "CommunityRating", order: "Descending", page, limit: 30 });

export const getNowPlayingMovies = () => api<TMDBResponse>("/latest", { type: "movie" });
export const getUpcomingMovies = () =>
  api<TMDBResponse>("/items", { type: "movie", sort: "PremiereDate", order: "Descending", limit: 30 });

export const getPopularTV = (page = 1) =>
  api<TMDBResponse>("/items", { type: "series", sort: "PlayCount,CommunityRating", order: "Descending", page, limit: 30 });
export const getTopRatedTV = () =>
  api<TMDBResponse>("/items", { type: "series", sort: "CommunityRating", order: "Descending", limit: 30 });
export const getAiringTodayTV = () => api<TMDBResponse>("/latest", { type: "series" });

export const getMoviesByGenre = (genreId: number | string, page = 1) =>
  api<TMDBResponse>("/items", { type: "movie", genre: String(genreId), page, limit: 30 });
export const getTVByGenre = (genreId: number | string, page = 1) =>
  api<TMDBResponse>("/items", { type: "series", genre: String(genreId), page, limit: 30 });

export const getMovieGenres = () => api<{ genres: TMDBGenre[] }>("/genres", { type: "movie" });
export const getTVGenres = () => api<{ genres: TMDBGenre[] }>("/genres", { type: "series" });

export const getMovieDetail = (id: string | number) => api<TMDBDetail>(`/item/${id}`);
export const getTVDetail = (id: string | number) => api<TMDBDetail>(`/item/${id}`);
export const getSeasonDetail = (tvId: string | number, seasonNumber: number) =>
  api<TMDBSeasonDetail>(`/seasons/${tvId}/${seasonNumber}`);

export const searchMulti = (query: string, _page = 1) =>
  api<TMDBResponse>("/search", { q: query });

export const getSimilarMovies = (id: string | number) => api<TMDBResponse>(`/similar/${id}`);
export const getSimilarTV = (id: string | number) => api<TMDBResponse>(`/similar/${id}`);

export const getCredits = async (_mediaType: "movie" | "tv", id: string | number) => {
  const detail = await api<TMDBDetail>(`/item/${id}`);
  return detail.credits || { cast: [], crew: [] };
};

// ---- Jellyfin account linking ----
export const getJellyfinLinkStatus = () => api<{ linked: boolean; username: string | null }>("/link");
export const linkJellyfinAccount = async (username: string, password: string) => {
  const r = await fetch(`${FN_BASE}/link`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Link failed");
  return r.json();
};
export const unlinkJellyfinAccount = async () => {
  const r = await fetch(`${FN_BASE}/link`, { method: "DELETE", headers: await authHeaders() });
  return r.json();
};
export const getJellyfinServerStatus = () => api<{ ok: boolean; serverName?: string; version?: string }>("/server-status");

// ---- Playback ----
export const getStreamUrl = (itemId: string | number) =>
  api<{ url: string; kind: "hls"; expiresAt: number }>(`/stream-url/${itemId}`);
export const reportProgress = async (itemId: string | number, positionTicks: number) => {
  await fetch(`${FN_BASE}/progress`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, positionTicks }),
  });
};

// ---- shape helpers ----
export const getTitle = (item: TMDBMovie) => item.title || item.name || "Untitled";
export const getYear = (item: TMDBMovie) => {
  const date = item.release_date || item.first_air_date;
  return date ? date.split("-")[0] : "";
};
export const getMediaType = (item: TMDBMovie): "movie" | "tv" => {
  if (item.media_type === "tv" || item.media_type === "movie") return item.media_type;
  return item.title ? "movie" : "tv";
};
