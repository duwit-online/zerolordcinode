import { useEffect, useState } from "react";
import { Crown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialSettings } from "@/hooks/useTrialSettings";
import { useSubscription, useIsPremium } from "@/hooks/useSubscription";

const STORAGE_KEY = "cinode_trial_banner_dismissed";

const TrialBanner = () => {
  const { user } = useAuth();
  const { data: trial } = useTrialSettings();
  const { data: subscription } = useSubscription();
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  if (!user || !trial?.show_banner || !isPremium || subscription?.plan_type !== "trial" || dismissed) {
    return null;
  }

  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)) : trial.days;

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="sticky top-0 z-[55] bg-gradient-to-r from-primary/90 via-primary to-accent text-primary-foreground shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-xs sm:text-sm">
        <Crown size={16} className="flex-shrink-0" />
        <p className="flex-1 font-medium truncate">
          Free trial active — {daysLeft} {daysLeft === 1 ? "day" : "days"} left.
          <span className="hidden sm:inline"> Upgrade to keep premium access after it ends.</span>
        </p>
        <button
          onClick={() => navigate("/premium")}
          className="px-3 py-1 rounded-full bg-background/20 hover:bg-background/30 font-semibold whitespace-nowrap"
        >
          Upgrade
        </button>
        <button onClick={handleDismiss} className="p-1 hover:bg-background/20 rounded-full" aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default TrialBanner;
