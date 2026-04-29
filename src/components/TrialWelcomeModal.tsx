import { useEffect, useState } from "react";
import { Crown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialSettings } from "@/hooks/useTrialSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

const TrialWelcomeModal = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { data: trial } = useTrialSettings();
  const { data: subscription } = useSubscription();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (
      user &&
      profile &&
      trial?.show_modal &&
      trial.enabled &&
      subscription?.plan_type === "trial" &&
      !profile.trial_acknowledged
    ) {
      setOpen(true);
    }
  }, [user, profile, trial, subscription]);

  const acknowledge = async () => {
    if (!user) return;
    setOpen(false);
    await supabase.from("profiles").update({ trial_acknowledged: true } as any).eq("user_id", user.id);
    await refreshProfile();
  };

  if (!open || !trial) return null;

  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const daysLeft = expiresAt ? Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)) : trial.days;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="glass rounded-3xl border border-primary/30 p-6 max-w-md w-full text-center relative">
        <button onClick={acknowledge} className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
          <X size={18} />
        </button>
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3">
          <Crown size={28} className="text-primary-foreground" />
        </div>
        <h2 className="font-display font-bold text-xl mb-2">🎉 Your free trial is active!</h2>
        <p className="text-sm text-muted-foreground mb-3">{trial.note}</p>
        <p className="text-xs text-primary font-semibold mb-5">
          {daysLeft} {daysLeft === 1 ? "day" : "days"} of premium access included
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { acknowledge(); navigate("/app"); }}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
          >
            Start Watching
          </button>
          <button
            onClick={() => { acknowledge(); navigate("/premium"); }}
            className="w-full py-3 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/50"
          >
            View Premium Plans
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialWelcomeModal;
