import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlayerSource } from "@/components/watch/CinodePlayer";

interface ResolveArgs {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const DEFAULT_ORDER = ["jellyfin_direct", "jellyfin_hls", "override", "vidsrc", "vidsrc_xyz", "2embed", "superembed", "vidlink", "smashy"];

function embedUrl(key: string, a: ResolveArgs): PlayerSource | null {
  const isTV = a.type === "tv";
  const s = a.season || 1, e = a.episode || 1;
  switch (key) {
    case "vidsrc": return { kind: "iframe", label: "VidSrc", url: isTV ? `https://vidsrc.to/embed/tv/${a.tmdbId}/${s}/${e}` : `https://vidsrc.to/embed/movie/${a.tmdbId}` };
    case "vidsrc_xyz": return { kind: "iframe", label: "VidSrc XYZ", url: isTV ? `https://vidsrc.xyz/embed/tv/${a.tmdbId}/${s}/${e}` : `https://vidsrc.xyz/embed/movie/${a.tmdbId}` };
    case "2embed": return { kind: "iframe", label: "2Embed", url: isTV ? `https://www.2embed.cc/embedtv/${a.tmdbId}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${a.tmdbId}` };
    case "superembed": return { kind: "iframe", label: "SuperEmbed", url: isTV ? `https://multiembed.mov/?video_id=${a.tmdbId}&tmdb=1&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${a.tmdbId}&tmdb=1` };
    case "vidlink": return { kind: "iframe", label: "VidLink", url: isTV ? `https://vidlink.pro/tv/${a.tmdbId}/${s}/${e}` : `https://vidlink.pro/movie/${a.tmdbId}` };
    case "smashy": return { kind: "iframe", label: "Smashy", url: isTV ? `https://embed.smashystream.com/playere.php?tmdb=${a.tmdbId}&season=${s}&episode=${e}` : `https://embed.smashystream.com/playere.php?tmdb=${a.tmdbId}` };
    default: return null;
  }
}

export function useResolveSources(args: ResolveArgs) {
  const [sources, setSources] = useState<PlayerSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Get admin-configured order
      const { data: orderRow } = await supabase.from("app_settings").select("value").eq("key", "playback_order").maybeSingle();
      const order: string[] = (orderRow?.value as any)?.order || DEFAULT_ORDER;

      // Resolve jellyfin once
      let jfDirect: PlayerSource | null = null;
      let jfHls: PlayerSource | null = null;
      try {
        const params = new URLSearchParams({ tmdbId: String(args.tmdbId), type: args.type });
        if (args.type === "tv") { params.set("season", String(args.season || 1)); params.set("episode", String(args.episode || 1)); }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/jellyfin-proxy/resolve?${params}`, {
          headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        });
        if (res.ok) {
          const j = await res.json();
          if (j.directUrl) jfDirect = { kind: "mp4", label: `Jellyfin Direct${j.serverName ? ` · ${j.serverName}` : ""}`, url: j.directUrl };
          if (j.hlsUrl) jfHls = { kind: "hls", label: `Jellyfin HLS${j.serverName ? ` · ${j.serverName}` : ""}`, url: j.hlsUrl };
        }
      } catch (e) { console.warn("jellyfin resolve failed", e); }

      // Resolve override once
      let override: PlayerSource | null = null;
      try {
        let q = supabase.from("movie_overrides").select("custom_url").eq("tmdb_id", args.tmdbId).eq("media_type", args.type);
        if (args.type === "tv") { q = q.eq("season", args.season || 1).eq("episode", args.episode || 1); }
        const { data } = await q.limit(1).maybeSingle();
        if (data?.custom_url) {
          const url = data.custom_url;
          const isHls = /\.m3u8(\?|$)/i.test(url);
          const isMp4 = /\.(mp4|mkv|webm)(\?|$)/i.test(url);
          override = { kind: isHls ? "hls" : isMp4 ? "mp4" : "iframe", label: "Admin Override", url };
        }
      } catch (e) { console.warn("override fetch failed", e); }

      const list: PlayerSource[] = [];
      for (const key of order) {
        if (key === "jellyfin_direct" && jfDirect) list.push(jfDirect);
        else if (key === "jellyfin_hls" && jfHls) list.push(jfHls);
        else if (key === "override" && override) list.push(override);
        else { const e = embedUrl(key, args); if (e) list.push(e); }
      }

      if (!cancelled) { setSources(list); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [args.tmdbId, args.type, args.season, args.episode]);

  return { sources, loading };
}
