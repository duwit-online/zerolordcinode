import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const upsert = () =>
      supabase.from("user_presence").upsert(
        { user_id: user.id, is_online: true, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    upsert();
    const interval = setInterval(upsert, 60_000); // heartbeat every 60s

    const goOffline = () => {
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`,
        JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() })
      );
    };

    window.addEventListener("beforeunload", goOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", goOffline);
      supabase.from("user_presence").upsert(
        { user_id: user.id, is_online: false, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    };
  }, [user?.id]);
}
