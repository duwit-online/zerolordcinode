import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrialSettings {
  enabled: boolean;
  days: number;
  note: string;
  show_notification: boolean;
  show_modal: boolean;
  show_banner: boolean;
}

const DEFAULTS: TrialSettings = {
  enabled: true,
  days: 1,
  note: "Welcome to Cinode! You have a free trial. Upgrade anytime to keep enjoying premium content.",
  show_notification: true,
  show_modal: true,
  show_banner: true,
};

export const useTrialSettings = () => {
  return useQuery({
    queryKey: ["trial-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "trial_settings")
        .maybeSingle();
      const value = (data?.value as Partial<TrialSettings>) || {};
      return { ...DEFAULTS, ...value } as TrialSettings;
    },
    staleTime: 5 * 60_000,
  });
};
