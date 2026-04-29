import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VideoAdSettings {
  enabled: boolean;
  provider_name: string;
  sdk: "google_ima";
  pre_roll_tag_url: string;
  mid_roll_tag_url: string;
  post_roll_tag_url: string;
  fallback_to_direct_ads: boolean;
}

const defaultVideoAdSettings: VideoAdSettings = {
  enabled: false,
  provider_name: "Google IMA",
  sdk: "google_ima",
  pre_roll_tag_url: "",
  mid_roll_tag_url: "",
  post_roll_tag_url: "",
  fallback_to_direct_ads: true,
};

export const useActiveAds = (placement?: string) => {
  return useQuery({
    queryKey: ["ads", placement],
    queryFn: async () => {
      let query = supabase.from("ads").select("*").eq("is_active", true);
      if (placement) query = query.eq("placement", placement);
      const { data } = await query.order("priority", { ascending: false });
      return (data as any[]) || [];
    },
    staleTime: 60_000,
  });
};

export const useVideoAdSettings = () => {
  return useQuery({
    queryKey: ["video-ad-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "video_ad_settings").maybeSingle();
      return { ...defaultVideoAdSettings, ...((data?.value as Partial<VideoAdSettings> | null) || {}) };
    },
    staleTime: 60_000,
  });
};

export const useTrackAdClick = () => {
  return async (adId: string) => {
    try {
      await supabase.rpc("increment_ad_clicks" as any, { ad_id: adId });
    } catch {
      // silent
    }
  };
};
