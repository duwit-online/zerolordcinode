import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useActiveAds, useVideoAdSettings } from "@/hooks/useAds";
import { useIsPremium } from "@/hooks/useSubscription";
import ImaAdOverlay from "@/components/ImaAdOverlay";

interface PreRollAdProps {
  onComplete: () => void;
}

const PreRollAd = ({ onComplete }: PreRollAdProps) => {
  const { data: ads, isLoading } = useActiveAds("watch_page");
  const { data: videoAdSettings } = useVideoAdSettings();
  const { isPremium } = useIsPremium();
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);

  const preRollAd = ads?.find((a: any) => a.ad_type === "pre_roll");
  const imaTagUrl = videoAdSettings?.enabled ? videoAdSettings.pre_roll_tag_url : "";

  useEffect(() => {
    // Skip ads for premium users or if no ad and done loading
    if (isPremium) { onComplete(); return; }
    if (imaTagUrl) return;
    if (!isLoading && !preRollAd) { onComplete(); return; }
    if (isLoading) return; // Wait for ads to load

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setCanSkip(true);
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [imaTagUrl, preRollAd, onComplete, isLoading, isPremium]);

  if (imaTagUrl && !isPremium) {
    return <ImaAdOverlay adTagUrl={imaTagUrl} label={videoAdSettings?.provider_name || "Google IMA"} onComplete={onComplete} show />;
  }

  if (isPremium || isLoading || !preRollAd) return null;

  return (
    <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center">
      <div className="absolute top-2 left-3 text-[10px] font-black tracking-widest text-orange-400 uppercase">Ad</div>
      
      {preRollAd.video_url ? (
        <video src={preRollAd.video_url} autoPlay muted className="w-full h-full object-contain" onEnded={onComplete} />
      ) : preRollAd.image_url ? (
        <a href={preRollAd.link_url || "#"} target="_blank" rel="noopener noreferrer">
          <img src={preRollAd.image_url} alt={preRollAd.name} className="max-w-full max-h-full object-contain" />
        </a>
      ) : preRollAd.content_html ? (
        <div className="max-w-lg mx-auto p-4" dangerouslySetInnerHTML={{ __html: preRollAd.content_html }} />
      ) : null}

      <div className="absolute top-3 right-3">
        {canSkip ? (
          <button onClick={onComplete} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-sm font-medium flex items-center gap-1 hover:bg-white/30 transition-colors">
            <X size={14} /> Skip Ad
          </button>
        ) : (
          <span className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur text-white/80 text-sm">
            Skip in {countdown}s
          </span>
        )}
      </div>
    </div>
  );
};

export default PreRollAd;
