import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlayerSource } from "@/components/watch/CinodePlayer";
import { getStreamUrl } from "@/lib/tmdb";

interface ResolveArgs {
  tmdbId: string | number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  title?: string;
  year?: number;
}

// In the Jellyfin-only architecture the "tmdbId" carried by the UI is the
// Jellyfin item id. For TV, we resolve the episode's Jellyfin id via the
// season endpoint before requesting the signed stream URL.
export function useResolveSources(args: ResolveArgs) {
  const [sources, setSources] = useState<PlayerSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list: PlayerSource[] = [];
      try {
        let itemId: string | number = args.tmdbId;

        if (args.type === "tv") {
          // fetch season episodes to translate (season,episode) -> jellyfin episode id
          const seasonRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jellyfin-api/seasons/${args.tmdbId}/${args.season || 1}`,
            { headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}` } },
          );
          const seasonJson = await seasonRes.json().catch(() => ({ episodes: [] }));
          const ep = (seasonJson.episodes || []).find((e: any) => e.episode_number === (args.episode || 1));
          if (ep?.id) itemId = ep.id;
        }

        // 1) Admin URL override (if any)
        try {
          const { data } = await supabase
            .from("movie_overrides")
            .select("custom_url")
            .eq("tmdb_id", String(args.tmdbId) as any)
            .eq("media_type", args.type)
            .limit(1)
            .maybeSingle();
          if (data?.custom_url) {
            const url = data.custom_url as string;
            const isHls = /\.m3u8(\?|$)/i.test(url);
            const isMp4 = /\.(mp4|mkv|webm)(\?|$)/i.test(url);
            list.push({ kind: isHls ? "hls" : isMp4 ? "mp4" : "iframe", label: "Admin Override", url });
          }
        } catch { /* overrides table optional */ }

        // 2) Jellyfin signed HLS
        try {
          const stream = await getStreamUrl(itemId);
          if (stream?.url) list.push({ kind: "hls", label: "Jellyfin", url: stream.url });
        } catch (e) {
          console.warn("jellyfin stream unavailable", e);
        }
      } finally {
        if (!cancelled) { setSources(list); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [args.tmdbId, args.type, args.season, args.episode]);

  return { sources, loading };
}
