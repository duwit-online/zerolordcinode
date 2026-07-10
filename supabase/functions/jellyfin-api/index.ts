// Jellyfin API proxy — all Jellyfin URL / API key / admin creds live only here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const JF_URL = (Deno.env.get("JELLYFIN_SERVER_URL") || "").replace(/\/+$/, "");
const JF_KEY = Deno.env.get("JELLYFIN_API_KEY") || "";
const JF_ADMIN_USER = Deno.env.get("JELLYFIN_ADMIN_USERNAME") || "";
const JF_ADMIN_PASS = Deno.env.get("JELLYFIN_ADMIN_PASSWORD") || "";
const ENC_KEY = Deno.env.get("JELLYFIN_TOKEN_ENC_KEY") || "dev-key";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let cachedAdminUserId = "";
async function adminUserId(): Promise<string> {
  if (cachedAdminUserId) return cachedAdminUserId;
  const r = await fetch(`${JF_URL}/Users?api_key=${JF_KEY}`);
  const arr = await r.json();
  const admin = arr.find((u: any) => u.Name === JF_ADMIN_USER) || arr[0];
  cachedAdminUserId = admin?.Id || "";
  return cachedAdminUserId;
}

function jf(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${JF_URL}${path}`);
  url.searchParams.set("api_key", JF_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function jfJson(path: string, params: Record<string, any> = {}): Promise<any> {
  const r = await fetch(jf(path, params), { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`jellyfin ${path} -> ${r.status}`);
  return await r.json();
}

// ---- crypto helpers ----
async function hmac(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ENC_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const rawKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ENC_KEY));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token)));
  const buf = new Uint8Array(iv.length + ct.length);
  buf.set(iv); buf.set(ct, iv.length);
  return btoa(String.fromCharCode(...buf));
}
async function decryptToken(payload: string): Promise<string> {
  const buf = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const rawKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ENC_KEY));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ---- item mapping to TMDB-ish shape ----
function mapItem(it: any): any {
  const isSeries = it.Type === "Series";
  const primaryTag = it.ImageTags?.Primary;
  const backdropTag = it.BackdropImageTags?.[0];
  return {
    id: it.Id,
    jellyfin_id: it.Id,
    type_jf: it.Type,
    title: !isSeries ? (it.Name || "") : undefined,
    name: isSeries ? (it.Name || "") : undefined,
    original_title: it.OriginalTitle,
    poster_path: primaryTag ? `${it.Id}?type=Primary&tag=${primaryTag}` : null,
    backdrop_path: backdropTag ? `${it.Id}?type=Backdrop&tag=${backdropTag}` : (primaryTag ? `${it.Id}?type=Primary&tag=${primaryTag}` : null),
    overview: it.Overview || "",
    vote_average: it.CommunityRating || 0,
    release_date: !isSeries ? (it.PremiereDate?.slice(0, 10) || "") : "",
    first_air_date: isSeries ? (it.PremiereDate?.slice(0, 10) || "") : "",
    genre_ids: [],
    media_type: isSeries ? "tv" : "movie",
    runtime: it.RunTimeTicks ? Math.round(it.RunTimeTicks / 600_000_000) : undefined,
    number_of_seasons: it.ChildCount,
    genres: (it.Genres || []).map((g: string, i: number) => ({ id: i, name: g })),
    tagline: it.Taglines?.[0],
    status: it.Status,
  };
}

function mapEpisode(ep: any): any {
  return {
    id: ep.Id,
    episode_number: ep.IndexNumber || 0,
    name: ep.Name || `Episode ${ep.IndexNumber || 0}`,
    overview: ep.Overview || "",
    still_path: ep.ImageTags?.Primary ? `${ep.Id}?type=Primary&tag=${ep.ImageTags.Primary}` : null,
    vote_average: ep.CommunityRating || 0,
    air_date: ep.PremiereDate?.slice(0, 10) || "",
  };
}

function tmdbResp(items: any[]) {
  return { results: items.map(mapItem), page: 1, total_pages: 1, total_results: items.length };
}

// ---- auth guard ----
async function requireUser(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  return { userId: data.claims.sub as string };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- handlers ----
async function handleList(u: URL) {
  const type = u.searchParams.get("type"); // movie | series
  const includeItemTypes = type === "series" ? "Series" : type === "movie" ? "Movie" : "Movie,Series";
  const params: Record<string, any> = {
    IncludeItemTypes: includeItemTypes,
    Recursive: true,
    Fields: "PrimaryImageAspectRatio,Overview,Genres,PremiereDate,CommunityRating,RunTimeTicks",
    ImageTypeLimit: 1,
    EnableImageTypes: "Primary,Backdrop",
    Limit: Number(u.searchParams.get("limit") || 30),
    StartIndex: (Number(u.searchParams.get("page") || 1) - 1) * Number(u.searchParams.get("limit") || 30),
    SortBy: u.searchParams.get("sort") || "SortName",
    SortOrder: u.searchParams.get("order") || "Ascending",
  };
  const genre = u.searchParams.get("genre");
  if (genre) params.Genres = genre;
  const years = u.searchParams.get("years");
  if (years) params.Years = years;
  const uid = await adminUserId();
  const data = await jfJson(`/Users/${uid}/Items`, params);
  return json(tmdbResp(data.Items || []));
}

async function handleLatest(u: URL) {
  const type = u.searchParams.get("type") || "movie";
  const uid = await adminUserId();
  const data = await jfJson(`/Users/${uid}/Items/Latest`, {
    IncludeItemTypes: type === "series" ? "Series" : "Movie",
    Limit: 30,
    Fields: "Overview,Genres,PremiereDate,CommunityRating,RunTimeTicks",
    EnableImageTypes: "Primary,Backdrop",
  });
  return json(tmdbResp(Array.isArray(data) ? data : (data.Items || [])));
}

async function handleSearch(u: URL) {
  const q = u.searchParams.get("q") || "";
  if (!q) return json({ results: [], page: 1, total_pages: 0, total_results: 0 });
  const uid = await adminUserId();
  const data = await jfJson(`/Users/${uid}/Items`, {
    SearchTerm: q,
    Recursive: true,
    IncludeItemTypes: "Movie,Series",
    Fields: "Overview,Genres,PremiereDate,CommunityRating",
    Limit: 40,
  });
  return json(tmdbResp(data.Items || []));
}

async function handleItem(itemId: string) {
  const uid = await adminUserId();
  const data = await jfJson(`/Users/${uid}/Items/${itemId}`, {
    Fields: "Overview,Genres,People,PremiereDate,CommunityRating,RunTimeTicks,Taglines,Studios,ProductionYear,ChildCount",
  });
  const mapped = mapItem(data);
  if (data.Type === "Series") {
    const seasons = await jfJson(`/Shows/${itemId}/Seasons`, { UserId: uid, Fields: "Overview" });
    mapped.number_of_seasons = seasons.Items?.filter((s: any) => (s.IndexNumber || 0) > 0).length || 0;
    mapped.seasons = (seasons.Items || []).map((s: any) => ({
      id: s.Id,
      season_number: s.IndexNumber || 0,
      name: s.Name,
      episode_count: s.ChildCount || 0,
      poster_path: s.ImageTags?.Primary ? `${s.Id}?type=Primary&tag=${s.ImageTags.Primary}` : null,
    }));
  }
  // credits
  mapped.credits = {
    cast: (data.People || []).filter((p: any) => p.Type === "Actor").slice(0, 20).map((p: any) => ({
      id: p.Id, name: p.Name, character: p.Role,
      profile_path: p.PrimaryImageTag ? `${p.Id}?type=Primary&tag=${p.PrimaryImageTag}` : null,
    })),
    crew: (data.People || []).filter((p: any) => p.Type !== "Actor").map((p: any) => ({
      id: p.Id, name: p.Name, job: p.Role || p.Type, department: p.Type === "Director" ? "Directing" : p.Type,
    })),
  };
  return json(mapped);
}

async function handleSeason(seriesId: string, seasonNumber: number) {
  const uid = await adminUserId();
  const data = await jfJson(`/Shows/${seriesId}/Episodes`, {
    Season: seasonNumber,
    UserId: uid,
    Fields: "Overview,PremiereDate,CommunityRating",
  });
  return json({ episodes: (data.Items || []).map(mapEpisode) });
}

async function handleSimilar(itemId: string) {
  const uid = await adminUserId();
  const data = await jfJson(`/Items/${itemId}/Similar`, { UserId: uid, Limit: 20, Fields: "Overview,PremiereDate,CommunityRating" });
  return json(tmdbResp(data.Items || []));
}

async function handleGenres(u: URL) {
  const type = u.searchParams.get("type") || "movie";
  const uid = await adminUserId();
  const data = await jfJson(`/Genres`, {
    IncludeItemTypes: type === "series" ? "Series" : "Movie",
    UserId: uid,
    Recursive: true,
  });
  return json({ genres: (data.Items || []).map((g: any) => ({ id: g.Name, name: g.Name })) });
}

async function handleImage(itemId: string, u: URL) {
  const type = u.searchParams.get("type") || "Primary";
  const tag = u.searchParams.get("tag");
  const size = u.searchParams.get("size") || "w780";
  const width = /^w(\d+)$/.exec(size)?.[1];
  const params: Record<string, any> = { api_key: JF_KEY, tag, quality: 90 };
  if (width) params.maxWidth = width;
  const url = new URL(`${JF_URL}/Items/${itemId}/Images/${type}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  const r = await fetch(url.toString());
  const headers = new Headers({ ...corsHeaders });
  headers.set("Content-Type", r.headers.get("Content-Type") || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=86400");
  return new Response(r.body, { status: r.status, headers });
}

async function handleLinkStatus(userId: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data } = await sb.from("jellyfin_user_links").select("jellyfin_username").eq("user_id", userId).maybeSingle();
  return json({ linked: !!data, username: data?.jellyfin_username || null });
}

async function handleLink(req: Request, userId: string) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || typeof password !== "string") return json({ error: "username and password required" }, 400);
  const r = await fetch(`${JF_URL}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Authorization": `MediaBrowser Client="Cinode", Device="Web", DeviceId="cinode-${userId}", Version="1.0"`,
    },
    body: JSON.stringify({ Username: username, Pw: password }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return json({ error: "Jellyfin authentication failed", detail: t.slice(0, 200) }, 401);
  }
  const auth = await r.json();
  const encrypted = await encryptToken(auth.AccessToken);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await sb.from("jellyfin_user_links").upsert({
    user_id: userId,
    jellyfin_user_id: auth.User.Id,
    jellyfin_username: auth.User.Name,
    access_token_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  return json({ linked: true, username: auth.User.Name });
}

async function handleUnlink(userId: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await sb.from("jellyfin_user_links").delete().eq("user_id", userId);
  return json({ linked: false });
}

async function getUserJfContext(userId: string): Promise<{ jfUserId: string; token: string }> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data } = await sb.from("jellyfin_user_links").select("*").eq("user_id", userId).maybeSingle();
  if (data) {
    const token = await decryptToken(data.access_token_encrypted);
    return { jfUserId: data.jellyfin_user_id, token };
  }
  return { jfUserId: await adminUserId(), token: JF_KEY };
}

async function handleStreamUrl(itemId: string, userId: string) {
  const ctx = await getUserJfContext(userId);
  // Ask Jellyfin what streams are available
  const pb = await fetch(`${JF_URL}/Items/${itemId}/PlaybackInfo?UserId=${ctx.jfUserId}&api_key=${encodeURIComponent(ctx.token)}`);
  if (!pb.ok) return json({ error: "PlaybackInfo failed" }, 502);
  const info = await pb.json();
  const src = info.MediaSources?.[0];
  if (!src) return json({ error: "No sources" }, 404);
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 4;
  const sig = await hmac(`${itemId}:${userId}:${expires}`);
  const streamUrl = `${SUPABASE_URL}/functions/v1/jellyfin-api/stream/${itemId}/master.m3u8?u=${encodeURIComponent(userId)}&exp=${expires}&sig=${sig}`;
  return json({ url: streamUrl, kind: "hls", expiresAt: expires });
}

async function handleStreamMaster(itemId: string, u: URL) {
  const userId = u.searchParams.get("u") || "";
  const exp = Number(u.searchParams.get("exp") || 0);
  const sig = u.searchParams.get("sig") || "";
  if (!userId || !exp || exp < Math.floor(Date.now() / 1000)) return json({ error: "expired" }, 403);
  const expected = await hmac(`${itemId}:${userId}:${exp}`);
  if (expected !== sig) return json({ error: "bad signature" }, 403);
  const ctx = await getUserJfContext(userId);
  const master = `${JF_URL}/Videos/${itemId}/master.m3u8?api_key=${encodeURIComponent(ctx.token)}&MediaSourceId=${itemId}&VideoCodec=h264&AudioCodec=aac,mp3&TranscodingMaxAudioChannels=2&SegmentContainer=ts&MinSegments=1`;
  const r = await fetch(master);
  if (!r.ok) return json({ error: "master fetch failed" }, 502);
  let text = await r.text();
  // Rewrite child playlist and segment URIs through our proxy
  text = text.replace(/^(?!#)(\S+)$/gm, (line) => {
    if (!line.trim()) return line;
    const abs = line.startsWith("http") ? line : `${JF_URL}${line.startsWith("/") ? "" : "/"}${line}`;
    return `${SUPABASE_URL}/functions/v1/jellyfin-api/stream/proxy?url=${encodeURIComponent(abs)}&u=${encodeURIComponent(userId)}&exp=${exp}&sig=${sig}&i=${itemId}`;
  });
  return new Response(text, {
    headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
  });
}

async function handleStreamProxy(u: URL) {
  const target = u.searchParams.get("url") || "";
  const userId = u.searchParams.get("u") || "";
  const exp = Number(u.searchParams.get("exp") || 0);
  const sig = u.searchParams.get("sig") || "";
  const itemId = u.searchParams.get("i") || "";
  if (!target || !userId || !exp || exp < Math.floor(Date.now() / 1000)) return json({ error: "expired" }, 403);
  const expected = await hmac(`${itemId}:${userId}:${exp}`);
  if (expected !== sig) return json({ error: "bad signature" }, 403);
  if (!target.startsWith(JF_URL)) return json({ error: "invalid target" }, 400);
  const r = await fetch(target);
  const ct = r.headers.get("Content-Type") || "application/octet-stream";
  // If sub-playlist, rewrite too
  if (ct.includes("mpegurl") || target.includes(".m3u8")) {
    let text = await r.text();
    const base = new URL(target);
    text = text.replace(/^(?!#)(\S+)$/gm, (line) => {
      if (!line.trim()) return line;
      const abs = line.startsWith("http") ? line : new URL(line, base).toString();
      return `${SUPABASE_URL}/functions/v1/jellyfin-api/stream/proxy?url=${encodeURIComponent(abs)}&u=${encodeURIComponent(userId)}&exp=${exp}&sig=${sig}&i=${itemId}`;
    });
    return new Response(text, {
      headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
    });
  }
  const headers = new Headers({ ...corsHeaders });
  headers.set("Content-Type", ct);
  headers.set("Cache-Control", "public, max-age=60");
  return new Response(r.body, { status: r.status, headers });
}

async function handleProgress(req: Request, userId: string) {
  const { itemId, positionTicks } = await req.json().catch(() => ({}));
  if (!itemId) return json({ error: "itemId required" }, 400);
  const ctx = await getUserJfContext(userId);
  await fetch(`${JF_URL}/Sessions/Playing/Progress?api_key=${encodeURIComponent(ctx.token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ItemId: itemId, PositionTicks: positionTicks, IsPaused: false }),
  });
  return json({ ok: true });
}

async function handleServerStatus() {
  try {
    const r = await fetch(`${JF_URL}/System/Info/Public`);
    const data = await r.json();
    return json({ ok: true, serverName: data.ServerName, version: data.Version });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
}

// ---- router ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const u = new URL(req.url);
    // strip function prefix
    const path = u.pathname.replace(/^.*\/jellyfin-api/, "") || "/";

    // Public (unauth) routes — image + signed stream endpoints
    if (path.startsWith("/image/")) return await handleImage(path.split("/")[2], u);
    if (path.startsWith("/stream/") && path.endsWith("/master.m3u8")) {
      const itemId = path.split("/")[2];
      return await handleStreamMaster(itemId, u);
    }
    if (path === "/stream/proxy") return await handleStreamProxy(u);

    // Everything else requires auth
    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    if (path === "/server-status") return await handleServerStatus();
    if (path === "/items") return await handleList(u);
    if (path === "/latest") return await handleLatest(u);
    if (path === "/search") return await handleSearch(u);
    if (path === "/genres") return await handleGenres(u);
    if (path.startsWith("/item/")) return await handleItem(path.split("/")[2]);
    if (path.startsWith("/seasons/")) {
      const [, , seriesId, season] = path.split("/");
      return await handleSeason(seriesId, Number(season));
    }
    if (path.startsWith("/similar/")) return await handleSimilar(path.split("/")[2]);
    if (path === "/link" && req.method === "GET") return await handleLinkStatus(userId);
    if (path === "/link" && req.method === "POST") return await handleLink(req, userId);
    if (path === "/link" && req.method === "DELETE") return await handleUnlink(userId);
    if (path.startsWith("/stream-url/")) return await handleStreamUrl(path.split("/")[2], userId);
    if (path === "/progress" && req.method === "POST") return await handleProgress(req, userId);

    return json({ error: "not_found", path }, 404);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
