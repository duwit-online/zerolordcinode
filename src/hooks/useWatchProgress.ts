import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProgressKey {
  tmdbId: string | number;
  mediaType: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
}

export const useResumeProgress = (key: ProgressKey | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress", user?.id, key?.mediaType, key?.tmdbId, key?.season, key?.episode],
    enabled: !!user && !!key,
    queryFn: async () => {
      if (!user || !key) return null;
      let q = supabase.from("user_progress").select("*")
        .eq("user_id", user.id).eq("media_type", key.mediaType).eq("tmdb_id", key.tmdbId);
      if (key.mediaType === "tv") {
        q = q.eq("season", key.season ?? 1).eq("episode", key.episode ?? 1);
      } else {
        q = q.is("season", null).is("episode", null);
      }
      const { data } = await q.maybeSingle();
      return data as any;
    },
  });
};

export const useSaveProgress = (key: ProgressKey | null, title?: string, posterPath?: string | null) => {
  const { user } = useAuth();
  const lastSaved = useRef(0);
  const qc = useQueryClient();

  const save = useCallback(async (currentTime: number, duration: number) => {
    if (!user || !key || !duration || currentTime < 10) return;
    // Save every ~5 seconds
    const now = Date.now();
    if (now - lastSaved.current < 5000) return;
    lastSaved.current = now;

    const isTV = key.mediaType === "tv";
    const payload: any = {
      user_id: user.id,
      tmdb_id: key.tmdbId,
      media_type: key.mediaType,
      season: isTV ? (key.season ?? 1) : null,
      episode: isTV ? (key.episode ?? 1) : null,
      playback_time: currentTime,
      duration,
      last_played_at: new Date().toISOString(),
    };
    await supabase.from("user_progress").upsert(payload, {
      onConflict: isTV ? "user_id,media_type,tmdb_id,season,episode" : "user_id,media_type,tmdb_id",
    } as any);
    qc.invalidateQueries({ queryKey: ["continue-watching"] });
  }, [user, key, qc]);

  return save;
};

export const useContinueWatching = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["continue-watching", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("user_progress").select("*")
        .eq("user_id", user.id)
        .order("last_played_at", { ascending: false })
        .limit(20);
      // Filter out ones >95% done
      return ((data as any[]) || []).filter((p) => {
        if (!p.duration) return true;
        return p.playback_time / p.duration < 0.95;
      });
    },
  });
};
