import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PLAYBACK_ORDER, normalizePlaybackOrder } from "@/lib/playbackSources";

export const useAppSettings = () => {
  return useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*");
      const settings: Record<string, any> = {};
      data?.forEach((row: any) => {
        settings[row.key] = row.value;
      });
      settings.playback_order = {
        order: normalizePlaybackOrder(settings.playback_order?.order ?? DEFAULT_PLAYBACK_ORDER),
      };
      settings.mobile_app_links = {
        android: settings.mobile_app_links?.android ?? "",
        ios: settings.mobile_app_links?.ios ?? "",
      };
      return settings;
    },
    staleTime: 60_000,
  });
};

export const useUpdateSetting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const nextValue = key === "playback_order"
        ? { order: normalizePlaybackOrder(value?.order ?? DEFAULT_PLAYBACK_ORDER) }
        : value;

      const { data, error } = await supabase
        .from("app_settings")
        .upsert({ key, value: nextValue } as any, { onConflict: "key" })
        .select("key, value")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      qc.setQueryData(["appSettings"], (prev: Record<string, any> | undefined) => ({
        ...(prev ?? {}),
        [row.key]: row.value,
      }));
      qc.invalidateQueries({ queryKey: ["appSettings"] });
    },
  });
};
