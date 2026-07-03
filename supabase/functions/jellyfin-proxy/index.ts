// Jellyfin proxy + admin helper.
// Endpoints:
//   GET  /resolve?tmdbId=&type=movie|tv&season=&episode=
//   GET  /stream?u=<base64 absolute URL>
//   GET  /library?serverId=...&type=movie|tv&page=1&pageSize=50&search=
//   GET  /test?serverId=...                (connection test)
//   GET  /test-play?serverId=...&itemId=...(direct & hls URLs)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROXY_BASE = `${SUPABASE_URL}/functions/v1/jellyfin-proxy`;

const b64encode = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64decode = (s: string) => decodeURIComponent(escape(atob(s)));

const sb = () => createClient(SUPABASE_URL, SERVICE_ROLE);

async function getServers() {
  const { data } = await sb().from("streaming_servers")
    .select("id, name, server_url, api_key_encrypted, server_type, priority, is_enabled")
    .eq("is_enabled", true)
    .order("priority", { ascending: false });
  return (data || []).filter((s) => s.server_type === "jellyfin");
}
async function getServerById(id: string) {
  const { data } = await sb().from("streaming_servers")
    .select("id, name, server_url, api_key_encrypted, server_type")
    .eq("id", id).maybeSingle();
  return data;
}

async function jfFetch(base: string, apiKey: string, path: string) {
  const url = `${base.replace(/\/$/, "")}${path}`;
  const r = await fetch(url, { headers: { "X-Emby-Token": apiKey, "Accept": "application/json" } });
  if (!r.ok) throw new Error(`Jellyfin ${r.status} on ${path}`);
  return r.json();
}

// Robust TMDB lookup: try AnyProviderIdEquals first (case variations), fall back to scanning.
const normalizeTitle = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const titleSimilarity = (a: string, b: string) => {
  const aTokens = new Set(normalizeTitle(a).split(" ").filter((t) => t.length > 2));
  const bTokens = new Set(normalizeTitle(b).split(" ").filter((t) => t.length > 2));
  if (!aTokens.size || !bTokens.size) return 0;
  const shared = [...aTokens].filter((t) => bTokens.has(t)).length;
  return shared / Math.max(aTokens.size, bTokens.size);
};
const yearMatches = (itemYear: unknown, targetYear?: number) => {
  if (!targetYear) return true;
  const y = Number(itemYear || 0);
  return !!y && Math.abs(y - targetYear) <= 1;
};

async function findItem(base: string, apiKey: string, tmdbId: number, type: string, title?: string, year?: number) {
  const itemType = type === "tv" ? "Series" : "Movie";
  const titleKey = title ? normalizeTitle(title) : "";
  const matchTmdb = (it: any) => {
    const pids = it.ProviderIds || {};
    const k = Object.keys(pids).find((x) => x.toLowerCase() === "tmdb");
    if (!k || String(pids[k]) !== String(tmdbId)) return false;
    if (!titleKey) return true;
    const names = [it.Name, it.OriginalTitle].filter(Boolean);
    const closeTitle = names.some((n: string) => titleSimilarity(n, title) >= 0.5 || normalizeTitle(n).includes(titleKey) || titleKey.includes(normalizeTitle(n)));
    return closeTitle && yearMatches(it.ProductionYear, year);
  };
  const matchTitle = (it: any) => {
    if (!titleKey) return false;
    const names = [it.Name, it.OriginalTitle].filter(Boolean).map((n: string) => normalizeTitle(n));
    return names.some((n: string) => (n === titleKey || n.includes(titleKey) || titleKey.includes(n)) && yearMatches(it.ProductionYear, year));
  };
  const variants = [
    `Tmdb.${tmdbId}`,
    `tmdb.${tmdbId}`,
    `TMDB.${tmdbId}`,
    `Tmdb=${tmdbId}`,
  ];
  for (const v of variants) {
    try {
      const data = await jfFetch(
        base,
        apiKey,
        `/Items?Recursive=true&IncludeItemTypes=${itemType}&Fields=ProviderIds&AnyProviderIdEquals=${encodeURIComponent(v)}&Limit=5`,
      );
      const items = (data.Items || []).filter(matchTmdb);
      if (items.length) return items[0];
    } catch (_e) { /* try next */ }
  }

  if (titleKey) {
    try {
      const params = new URLSearchParams({
        Recursive: "true",
        IncludeItemTypes: itemType,
        Fields: "ProviderIds,ProductionYear,OriginalTitle",
        SearchTerm: title,
        Limit: "30",
      });
      const data = await jfFetch(base, apiKey, `/Items?${params}`);
      const items = data.Items || [];
      const tmdbMatch = items.find(matchTmdb);
      if (tmdbMatch) return tmdbMatch;
      const titleMatch = items.find(matchTitle);
      if (titleMatch) return titleMatch;
    } catch (_e) { /* fall back to library scan */ }
  }

  // Fallback: paginate (cap to avoid huge libraries) and match in code
  const data = await jfFetch(
    base,
    apiKey,
    `/Items?Recursive=true&IncludeItemTypes=${itemType}&Fields=ProviderIds,ProductionYear,OriginalTitle&Limit=2000`,
  );
  const items = data.Items || [];
  return items.find(matchTmdb) || items.find(matchTitle) || null;
}

async function findEpisode(base: string, apiKey: string, seriesId: string, season: number, episode: number) {
  const data = await jfFetch(base, apiKey, `/Shows/${seriesId}/Episodes?season=${season}`);
  return (data.Items || []).find((e: any) => e.IndexNumber === episode) || null;
}

function buildDirect(base: string, apiKey: string, itemId: string) {
  const b = base.replace(/\/$/, "");
  return `${b}/Videos/${itemId}/stream?api_key=${apiKey}&Static=true`;
}
function buildHls(base: string, apiKey: string, itemId: string) {
  const b = base.replace(/\/$/, "");
  return `${b}/Videos/${itemId}/master.m3u8?api_key=${apiKey}&MediaSourceId=${itemId}&VideoCodec=h264&AudioCodec=aac,mp3&TranscodingMaxAudioChannels=2&TranscodingProtocol=hls&SegmentContainer=ts&MinSegments=2`;
}

function rewritePlaylist(text: string, baseUrl: string): string {
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
  const sourceApiKey = new URL(baseUrl).searchParams.get("api_key");
  const proxied = (uri: string) => {
    const abs = new URL(uri, baseDir);
    if (sourceApiKey && !abs.searchParams.has("api_key")) abs.searchParams.set("api_key", sourceApiKey);
    return `${PROXY_BASE}/stream?u=${b64encode(abs.toString())}`;
  };
  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_m, u) => {
        return `URI="${proxied(u)}"`;
      });
    }
    return proxied(t);
  }).join("\n");
}

async function handleResolve(url: URL): Promise<Response> {
  const tmdbId = Number(url.searchParams.get("tmdbId"));
  const type = url.searchParams.get("type") || "movie";
  const season = Number(url.searchParams.get("season") || 0);
  const episode = Number(url.searchParams.get("episode") || 0);
  const title = url.searchParams.get("title") || undefined;
  const year = Number(url.searchParams.get("year") || 0) || undefined;
  if (!tmdbId) return json({ error: "tmdbId required" }, 400);

  const servers = await getServers();
  for (const srv of servers) {
    try {
      const item = await findItem(srv.server_url, srv.api_key_encrypted, tmdbId, type, title, year);
      if (!item) { console.log(`[resolve] no match for tmdb ${tmdbId} on ${srv.name}`); continue; }
      let target = item;
      if (type === "tv") {
        const ep = await findEpisode(srv.server_url, srv.api_key_encrypted, item.Id, season, episode);
        if (!ep) continue;
        target = ep;
      }
      const directAbs = buildDirect(srv.server_url, srv.api_key_encrypted, target.Id);
      const hlsAbs = buildHls(srv.server_url, srv.api_key_encrypted, target.Id);
      const directUrl = `${PROXY_BASE}/stream?u=${b64encode(directAbs)}`;
      const hlsUrl = `${PROXY_BASE}/stream?u=${b64encode(hlsAbs)}`;
      return json({ directUrl, hlsUrl, title: target.Name, itemId: target.Id, serverName: srv.name });
    } catch (e) { console.error("server failed", e); }
  }
  // Return 200 with found=false. "No Jellyfin match" is expected/normal — clients fall through to the next admin source.
  return json({ found: false });
}

async function handleStream(req: Request, url: URL): Promise<Response> {
  const u = url.searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400, headers: corsHeaders });
  let target: string;
  try { target = b64decode(u); } catch { return new Response("bad u", { status: 400, headers: corsHeaders }); }
  const headers: Record<string, string> = {};
  const range = req.headers.get("range");
  if (range) headers["Range"] = range;
  const upstream = await fetch(target, { headers });
  const ct = upstream.headers.get("content-type") || "";
  const isPlaylist = target.includes(".m3u8") || ct.includes("mpegurl") || ct.includes("application/x-mpegURL");
  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, target);
    return new Response(rewritten, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
    });
  }
  const passHeaders = new Headers(corsHeaders);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
    const v = upstream.headers.get(h); if (v) passHeaders.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: passHeaders });
}

async function handleLibrary(url: URL): Promise<Response> {
  const serverId = url.searchParams.get("serverId");
  const type = url.searchParams.get("type") || "movie";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(200, Math.max(10, Number(url.searchParams.get("pageSize") || 50)));
  const search = url.searchParams.get("search") || "";
  if (!serverId) return json({ error: "serverId required" }, 400);
  const srv = await getServerById(serverId);
  if (!srv) return json({ error: "server not found" }, 404);

  const itemType = type === "tv" ? "Series" : "Movie";
  const start = (page - 1) * pageSize;
  const params = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: itemType,
    Fields: "ProviderIds,DateCreated,Genres,ProductionYear,Overview,RunTimeTicks",
    SortBy: "DateCreated",
    SortOrder: "Descending",
    StartIndex: String(start),
    Limit: String(pageSize),
  });
  if (search) params.set("SearchTerm", search);

  try {
    const data = await jfFetch(srv.server_url, srv.api_key_encrypted, `/Items?${params}`);
    const items = (data.Items || []).map((it: any) => ({
      id: it.Id,
      name: it.Name,
      year: it.ProductionYear,
      type: itemType,
      tmdbId: (() => { const p = it.ProviderIds || {}; const k = Object.keys(p).find((x) => x.toLowerCase() === "tmdb"); return k ? p[k] : null; })(),
      imdbId: (() => { const p = it.ProviderIds || {}; const k = Object.keys(p).find((x) => x.toLowerCase() === "imdb"); return k ? p[k] : null; })(),
      genres: it.Genres || [],
      addedAt: it.DateCreated,
      runtimeMinutes: it.RunTimeTicks ? Math.round(it.RunTimeTicks / 600000000) : null,
      overview: it.Overview || "",
    }));
    return json({ items, total: data.TotalRecordCount || items.length, page, pageSize });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

async function handleTest(url: URL): Promise<Response> {
  const serverId = url.searchParams.get("serverId");
  if (!serverId) return json({ error: "serverId required" }, 400);
  const srv = await getServerById(serverId);
  if (!srv) return json({ error: "server not found" }, 404);
  try {
    const info = await jfFetch(srv.server_url, srv.api_key_encrypted, "/System/Info/Public");
    return json({ ok: true, serverName: info.ServerName, version: info.Version, productName: info.ProductName });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
}

async function handleTestPlay(url: URL): Promise<Response> {
  const serverId = url.searchParams.get("serverId");
  const itemId = url.searchParams.get("itemId");
  if (!serverId || !itemId) return json({ error: "serverId & itemId required" }, 400);
  const srv = await getServerById(serverId);
  if (!srv) return json({ error: "server not found" }, 404);
  const directAbs = buildDirect(srv.server_url, srv.api_key_encrypted, itemId);
  const hlsAbs = buildHls(srv.server_url, srv.api_key_encrypted, itemId);
  const directUrl = `${PROXY_BASE}/stream?u=${b64encode(directAbs)}`;
  const hlsUrl = `${PROXY_BASE}/stream?u=${b64encode(hlsAbs)}`;
  return json({ directUrl, hlsUrl });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function requireAdmin(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const client = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error } = await client.auth.getUser(token);
  if (error || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const { data: roleRow } = await client.from("user_roles").select("id").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/jellyfin-proxy/, "") || "/";
  try {
    if (path.startsWith("/resolve")) return await handleResolve(url);
    if (path.startsWith("/stream")) return await handleStream(req, url);
    if (path.startsWith("/library")) {
      const blocked = await requireAdmin(req); if (blocked) return blocked;
      return await handleLibrary(url);
    }
    if (path.startsWith("/test-play")) {
      const blocked = await requireAdmin(req); if (blocked) return blocked;
      return await handleTestPlay(url);
    }
    if (path.startsWith("/test")) {
      const blocked = await requireAdmin(req); if (blocked) return blocked;
      return await handleTest(url);
    }
    return json({ ok: true, message: "jellyfin-proxy", path });
  } catch (e) {
    console.error("jellyfin-proxy error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
