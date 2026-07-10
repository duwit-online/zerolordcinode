import { useQuery } from "@tanstack/react-query";
import * as tmdb from "@/lib/tmdb";

type Id = string | number;

export const useTrending = (timeWindow: "day" | "week" = "week") =>
  useQuery({ queryKey: ["trending", timeWindow], queryFn: () => tmdb.getTrending(timeWindow) });

export const usePopularMovies = (page = 1) =>
  useQuery({ queryKey: ["popular-movies", page], queryFn: () => tmdb.getPopularMovies(page) });

export const useTopRatedMovies = () =>
  useQuery({ queryKey: ["top-rated-movies"], queryFn: () => tmdb.getTopRatedMovies() });

export const useNowPlaying = () =>
  useQuery({ queryKey: ["now-playing"], queryFn: () => tmdb.getNowPlayingMovies() });

export const useUpcoming = () =>
  useQuery({ queryKey: ["upcoming"], queryFn: () => tmdb.getUpcomingMovies() });

export const usePopularTV = () =>
  useQuery({ queryKey: ["popular-tv"], queryFn: () => tmdb.getPopularTV() });

export const useTopRatedTV = () =>
  useQuery({ queryKey: ["top-rated-tv"], queryFn: () => tmdb.getTopRatedTV() });

export const useAiringToday = () =>
  useQuery({ queryKey: ["airing-today"], queryFn: () => tmdb.getAiringTodayTV() });

export const useMoviesByGenre = (genreId: Id, page = 1) =>
  useQuery({
    queryKey: ["movies-genre", genreId, page],
    queryFn: () => tmdb.getMoviesByGenre(genreId, page),
    enabled: !!genreId,
  });

export const useTVByGenre = (genreId: Id, page = 1) =>
  useQuery({
    queryKey: ["tv-genre", genreId, page],
    queryFn: () => tmdb.getTVByGenre(genreId, page),
    enabled: !!genreId,
  });

export const useMovieDetail = (id: Id) =>
  useQuery({ queryKey: ["movie-detail", id], queryFn: () => tmdb.getMovieDetail(id), enabled: !!id });

export const useTVDetail = (id: Id) =>
  useQuery({ queryKey: ["tv-detail", id], queryFn: () => tmdb.getTVDetail(id), enabled: !!id });

export const useSeasonDetail = (tvId: Id, season: number) =>
  useQuery({
    queryKey: ["season-detail", tvId, season],
    queryFn: () => tmdb.getSeasonDetail(tvId, season),
    enabled: !!tvId && season >= 0,
  });

export const useSearch = (query: string, page = 1) =>
  useQuery({
    queryKey: ["search", query, page],
    queryFn: () => tmdb.searchMulti(query, page),
    enabled: query.length > 1,
  });

export const useSimilar = (mediaType: "movie" | "tv", id: Id) =>
  useQuery({
    queryKey: ["similar", mediaType, id],
    queryFn: () => (mediaType === "movie" ? tmdb.getSimilarMovies(id) : tmdb.getSimilarTV(id)),
    enabled: !!id,
  });

export const useMovieGenres = () =>
  useQuery({ queryKey: ["movie-genres"], queryFn: tmdb.getMovieGenres });

export const useTVGenres = () =>
  useQuery({ queryKey: ["tv-genres"], queryFn: tmdb.getTVGenres });

export const useCredits = (mediaType: "movie" | "tv", id: Id) =>
  useQuery({
    queryKey: ["credits", mediaType, id],
    queryFn: () => tmdb.getCredits(mediaType, id),
    enabled: !!id,
  });
