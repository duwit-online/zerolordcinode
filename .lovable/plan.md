## Goal
Turn the app into a 100% Jellyfin client. The frontend never sees the Jellyfin URL, API key, or admin credentials — all traffic goes through one hardened Edge Function that uses the four secrets you just saved.

## Architecture

```text
Browser (unchanged UI)
   │  supabase.functions.invoke("jellyfin-api", { path, ... })
   ▼
Edge Function `jellyfin-api`   ← reads JELLYFIN_SERVER_URL / _API_KEY /
   │                             _ADMIN_USERNAME / _ADMIN_PASSWORD from env
   ▼
Jellyfin server  (never referenced from client code)
```

The client only ever sees:
- Item metadata (id, title, overview, year, genres, rating, runtime, seasons/episodes)
- Proxied image URLs of the form `/functions/v1/jellyfin-api/image/{itemId}?type=Primary`
- Proxied stream URLs of the form `/functions/v1/jellyfin-api/stream/{itemId}` (HLS master + segments rewritten through the proxy)

No Jellyfin host, no `api_key=`, no admin token ever reaches the browser or the network tab.

## Per-user Jellyfin accounts

New table `public.jellyfin_user_links`:
- `user_id` (FK-style to auth uid, unique)
- `jellyfin_user_id` (text)
- `jellyfin_username` (text)
- `access_token_encrypted` (text — encrypted with a server-side key)
- timestamps

Flow:
1. Under Settings → **Link Jellyfin Account**, the user enters their Jellyfin username + password.
2. Edge function calls `POST /Users/AuthenticateByName` on Jellyfin, receives the user's `AccessToken` + `User.Id`, encrypts and stores them.
3. All subsequent per-user calls (playback authorization, watch state, resume, favorites-sync) use that token server-side.
4. If a user has no link yet, the Watch page shows a one-tap "Link Jellyfin Account" prompt.
5. Admin creds are only used for library-wide reads (Home rows, catalog listing, genres, search, admin dashboard views), never for playback.

## Data source swap (TMDB → Jellyfin), UI unchanged

`src/lib/tmdb.ts` is replaced by `src/lib/jellyfin.ts` that exposes the **same function names and return shapes** the UI already uses (`getTrending`, `getPopularMovies`, `getTopRatedMovies`, `getNowPlaying`, `getUpcoming`, `getPopularTV`, `getTopRatedTV`, `getAiringToday`, `getMoviesByGenre`, `getTVByGenre`, `getMovieGenres`, `getTVGenres`, `getMovieDetail`, `getTVDetail`, `getSeasonDetail`, `searchMulti`, `getSimilarMovies`, `getSimilarTV`, `getCredits`, `getImageUrl`, `getBackdropUrl`, `getTitle`, `getYear`, `getMediaType`).

Mapping to Jellyfin equivalents (all via edge function):

| UI hook | Jellyfin call |
| --- | --- |
| Trending / Most Watched | `/Items?SortBy=PlayCount,DateCreated&Recursive=true&IncludeItemTypes=Movie,Series` |
| Popular Movies | `/Items?IncludeItemTypes=Movie&SortBy=PlayCount,CommunityRating` |
| Top Rated | `SortBy=CommunityRating&SortOrder=Descending` |
| Now Playing / Recently Added | `/Items/Latest?IncludeItemTypes=Movie` |
| Upcoming | items with future `PremiereDate` |
| Popular TV / Top Rated TV / Airing Today | same but `IncludeItemTypes=Series` |
| Movies/TV by Genre | `/Items?Genres=<name>&IncludeItemTypes=Movie` |
| Movie/TV Detail | `/Users/{admin}/Items/{id}?Fields=Overview,Genres,People,...` |
| Season detail | `/Shows/{seriesId}/Episodes?SeasonId=...` |
| Search | `/Items?SearchTerm=&Recursive=true` |
| Similar | `/Items/{id}/Similar` |
| Credits | `People` field from item |
| Image URL | proxy URL to edge function |
| Genres | `/Genres?IncludeItemTypes=Movie` etc. |

Because signatures stay identical, `useTMDB.ts`, `Index.tsx`, `Movies.tsx`, `TVShows.tsx`, `Search.tsx`, `Details.tsx`, `TMDBCard.tsx`, `TMDBRow.tsx`, `TMDBHero.tsx`, `ContinueWatchingRow.tsx`, etc. do not change visually — only their import points to the new lib.

Files renamed but UI-identical:
- `src/lib/tmdb.ts` → replaced with re-exports from `src/lib/jellyfin.ts`
- `useTMDB.ts` kept, now backed by Jellyfin

## Playback

`CinodePlayer.tsx` UI unchanged. Under the hood, `useResolveSources` becomes trivial:
- returns exactly one source: `/functions/v1/jellyfin-api/stream/{itemId}` (HLS)
- Edge function issues the correct Jellyfin `PlaybackInfo` request with the linked user's token, picks HLS transcode, and streams the m3u8 back — rewriting segment URIs to also flow through the proxy so the API key never leaks.

Watch progress on Jellyfin: after each 5-second local save, edge function forwards `POST /Sessions/Playing/Progress` so the user's Jellyfin resume state stays in sync.

## Things removed (per your instruction: "keep everything except TMDB + iframes")

- `src/lib/tmdb.ts` TMDB API key + all direct TMDB calls
- Iframe/embed sources (`2embed`, `superembed`, `vidlink`, `smashy`) from `playbackSources.ts`
- `AdminOverrides.tsx` module + `movie_overrides` table wiring (marked hidden; table left in DB for now)
- `streaming_servers` table stops being read (Jellyfin is preset in secrets); `AdminServers.tsx` becomes a read-only status page showing preset server info + connectivity test

## Things kept exactly as-is

- Auth, RBAC, admin premium
- Payments + Payment Config + Checkout
- Ads (banner + overlays)
- Affiliates (admin + user dashboard)
- Trial system, notifications, static pages
- Watchlist, Continue Watching, Downloads
- Every UI component and route (mobile nav, hero, cards, player) — pixel-identical
- Capacitor + Android APK workflow

## Migration (DB)

Single migration to add `jellyfin_user_links` with RLS (user reads/writes own row, service_role full), plus a small `jellyfin_status` row in `app_settings` for admin visibility of connection health.

## Rollout order

1. Migration for `jellyfin_user_links`
2. New edge function `jellyfin-api` (single file, all routes)
3. `src/lib/jellyfin.ts` (TMDB-shaped API surface)
4. `src/lib/tmdb.ts` becomes a thin re-export of `jellyfin.ts` (zero UI edits)
5. `useResolveSources` collapsed to a single Jellyfin source
6. `AdminServers.tsx` → preset-status view; `AdminOverrides.tsx` hidden from nav
7. Settings page gets a "Link Jellyfin Account" panel
8. Old `jellyfin-proxy` function retired (its logic folded into `jellyfin-api`)

## Security guarantees

- `JELLYFIN_SERVER_URL`, `JELLYFIN_API_KEY`, `JELLYFIN_ADMIN_USERNAME`, `JELLYFIN_ADMIN_PASSWORD` only read via `Deno.env.get()` inside the edge function; never returned in any response body, never logged.
- Per-user Jellyfin tokens stored encrypted at rest; only decrypted inside the edge function for the request lifetime.
- Every edge function route validates the Supabase JWT (`getClaims`) before touching Jellyfin.
- Image + stream proxy strips upstream headers that could leak the origin, and rewrites HLS playlists so segment URLs also flow through the proxy.
- No client bundle string will contain the Jellyfin host, API key, or admin username/password — verifiable by grepping the built `dist/`.

Approve and I'll build it in this order.