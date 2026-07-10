import { useCallback, useState } from "react";
import { isNative } from "@/lib/native";
import { downloadOffline, makeId, type OfflineMeta } from "@/lib/offlineDownloads";
import { toast } from "@/hooks/use-toast";

interface StartArgs {
  url: string;
  sourceLabel: string;
  tmdbId: string | number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  title: string;
  posterPath?: string | null;
}

export function useOfflineDownload() {
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async (args: StartArgs): Promise<OfflineMeta | null> => {
    if (!isNative()) {
      toast({ title: "Mobile app required", description: "Offline downloads are only available in the mobile app." });
      return null;
    }
    if (!/\.(mp4|mkv|webm|m3u8)(\?|$)/i.test(args.url)) {
      toast({ title: "Source not downloadable", description: "Pick a direct video source (Jellyfin or override).", variant: "destructive" });
      return null;
    }
    setBusy(true); setProgress(0);
    try {
      const id = makeId(args.tmdbId, args.type, args.season, args.episode);
      const meta = await downloadOffline({ id, ...args, onProgress: (p) => setProgress(p) });
      toast({ title: "Download complete", description: meta.title });
      return meta;
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message || String(e), variant: "destructive" });
      return null;
    } finally { setBusy(false); }
  }, []);

  return { start, progress, busy };
}
