import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useActiveAds, useVideoAdSettings } from "@/hooks/useAds";
import { useIsPremium } from "@/hooks/useSubscription";
import ImaAdOverlay from "@/components/ImaAdOverlay";

interface MidRollAdProps {
  currentTime: number;
  duration: number;
  onAdStart: () => void;
  onAdEnd: () => void;
  isPlaying: boolean;
}

const MID_ROLL_INTERVALS = [0.25, 0.5, 0.75]; // Show at 25%, 50%, 75%

const MidRollAd = ({ currentTime, duration, onAdStart, onAdEnd, isPlaying }: MidRollAdProps) => {
  const { data: ads } = useActiveAds("watch_page");
  const { data: videoAdSettings } = useVideoAdSettings();
  const { isPremium } = useIsPremium();
  const [showAd, setShowAd] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const triggeredAt = useRef<Set<number>>(new Set());
  const currentAd = useRef<any>(null);

  const midRollAds = ads?.filter((a: any) => a.ad_type === "mid_roll") || [];
  const imaTagUrl = videoAdSettings?.enabled ? videoAdSettings.mid_roll_tag_url : "";

  useEffect(() => {
    triggeredAt.current.clear();
  }, [duration]);

  useEffect(() => {
    if (isPremium || !isPlaying || duration < 120 || (!imaTagUrl && midRollAds.length === 0)) return;

    for (const ratio of MID_ROLL_INTERVALS) {
      const triggerTime = duration * ratio;
      if (currentTime >= triggerTime && currentTime < triggerTime + 2 && !triggeredAt.current.has(ratio)) {
        triggeredAt.current.add(ratio);
        currentAd.current = midRollAds.length ? midRollAds[Math.floor(Math.random() * midRollAds.length)] : null;
        setShowAd(true);
        setCountdown(5);
        setCanSkip(false);
        onAdStart();
        break;
      }
    }
  }, [currentTime, duration, imaTagUrl, isPlaying, isPremium, midRollAds, onAdStart]);

  useEffect(() => {
    if (!showAd) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setCanSkip(true); clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showAd]);

  const handleSkip = useCallback(() => {
    setShowAd(false);
    currentAd.current = null;
    onAdEnd();
  }, [onAdEnd]);

  if (imaTagUrl && !isPremium && showAd) {
    return <ImaAdOverlay adTagUrl={imaTagUrl} label={videoAdSettings?.provider_name || "Google IMA"} onComplete={handleSkip} show />;
  }

  if (isPremium || !showAd || !currentAd.current) return null;

  const ad = currentAd.current;

  return (
    <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center">
      <div className="absolute top-2 left-3 text-[10px] font-black tracking-widest text-orange-400 uppercase">Ad Break</div>

      {ad.video_url ? (
        <video src={ad.video_url} autoPlay muted className="w-full h-full object-contain" onEnded={handleSkip} />
      ) : ad.image_url ? (
        <a href={ad.link_url || "#"} target="_blank" rel="noopener noreferrer">
          <img src={ad.image_url} alt={ad.name} className="max-w-full max-h-[60vh] object-contain" />
        </a>
      ) : ad.content_html ? (
        <div className="max-w-lg mx-auto p-4" dangerouslySetInnerHTML={{ __html: ad.content_html }} />
      ) : null}

      <div className="absolute top-3 right-3">
        {canSkip ? (
          <button onClick={handleSkip} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-sm font-medium flex items-center gap-1 hover:bg-white/30 transition-colors">
            <X size={14} /> Skip
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

export default MidRollAd;
