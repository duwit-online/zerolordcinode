import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useActiveAds, useVideoAdSettings } from "@/hooks/useAds";
import { useIsPremium } from "@/hooks/useSubscription";
import ImaAdOverlay from "@/components/ImaAdOverlay";

interface PostRollAdProps {
  show: boolean;
  onComplete: () => void;
}

const PostRollAd = ({ show, onComplete }: PostRollAdProps) => {
  const { data: ads } = useActiveAds("watch_page");
  const { data: videoAdSettings } = useVideoAdSettings();
  const { isPremium } = useIsPremium();
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);

  const postRollAd = ads?.find((a: any) => a.ad_type === "post_roll");
  const imaTagUrl = videoAdSettings?.enabled ? videoAdSettings.post_roll_tag_url : "";

  useEffect(() => {
    if (!show || isPremium || imaTagUrl || !postRollAd) return;
    setCountdown(5);
    setCanSkip(false);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setCanSkip(true); clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [show, isPremium, imaTagUrl, postRollAd]);

  if (show && !isPremium && imaTagUrl) {
    return <ImaAdOverlay adTagUrl={imaTagUrl} label={videoAdSettings?.provider_name || "Google IMA"} onComplete={onComplete} show />;
  }

  if (!show || isPremium || !postRollAd) return null;

  return (
    <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center">
      <div className="absolute top-2 left-3 text-[10px] font-black tracking-widest text-orange-400 uppercase">Ad</div>

      {postRollAd.video_url ? (
        <video src={postRollAd.video_url} autoPlay muted className="w-full h-full object-contain" onEnded={onComplete} />
      ) : postRollAd.image_url ? (
        <a href={postRollAd.link_url || "#"} target="_blank" rel="noopener noreferrer">
          <img src={postRollAd.image_url} alt={postRollAd.name} className="max-w-full max-h-[60vh] object-contain" />
        </a>
      ) : postRollAd.content_html ? (
        <div className="max-w-lg mx-auto p-4" dangerouslySetInnerHTML={{ __html: postRollAd.content_html }} />
      ) : null}

      <div className="absolute top-3 right-3">
        {canSkip ? (
          <button onClick={onComplete} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-sm font-medium flex items-center gap-1 hover:bg-white/30 transition-colors">
            <X size={14} /> Close
          </button>
        ) : (
          <span className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur text-white/80 text-sm">
            Close in {countdown}s
          </span>
        )}
      </div>
    </div>
  );
};

export default PostRollAd;
