ALTER TABLE public.media_sources ALTER COLUMN tmdb_id TYPE text USING tmdb_id::text;
ALTER TABLE public.movie_overrides ALTER COLUMN tmdb_id TYPE text USING tmdb_id::text;
ALTER TABLE public.watchlist ALTER COLUMN tmdb_id TYPE text USING tmdb_id::text;
ALTER TABLE public.user_progress ALTER COLUMN tmdb_id TYPE text USING tmdb_id::text;