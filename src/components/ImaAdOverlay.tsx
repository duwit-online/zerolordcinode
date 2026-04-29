import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

let imaSdkPromise: Promise<void> | null = null;

const loadImaSdk = () => {
  if (window.google?.ima) return Promise.resolve();
  if (imaSdkPromise) return imaSdkPromise;

  imaSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ima-sdk="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google IMA SDK")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    script.async = true;
    script.dataset.imaSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google IMA SDK"));
    document.body.appendChild(script);
  });

  return imaSdkPromise;
};

interface ImaAdOverlayProps {
  adTagUrl: string;
  label: string;
  onComplete: () => void;
  show: boolean;
}

const ImaAdOverlay = ({ adTagUrl, label, onComplete, show }: ImaAdOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const completedRef = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!show || !adTagUrl) return;

    let adsManager: any = null;
    let adsLoader: any = null;
    let destroyed = false;

    const finish = () => {
      if (destroyed || completedRef.current) return;
      completedRef.current = true;
      setLoading(false);
      onComplete();
    };

    const setupAds = async () => {
      try {
        await loadImaSdk();

        if (destroyed || !window.google?.ima || !containerRef.current || !videoRef.current) {
          finish();
          return;
        }

        const google = window.google;
        const adContainer = containerRef.current;
        const adVideo = videoRef.current;
        adVideo.muted = true;
        adVideo.autoplay = true;
        adVideo.playsInline = true;
        adVideo.setAttribute("playsinline", "true");
        adVideo.setAttribute("webkit-playsinline", "true");

        const adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, adVideo);
        adsLoader = new google.ima.AdsLoader(adDisplayContainer);

        adsLoader.addEventListener(
          google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
          (event: any) => {
            try {
              const adsRenderingSettings = new google.ima.AdsRenderingSettings();
              adsRenderingSettings.enablePreloading = true;
              adsManager = event.getAdsManager(adVideo, adsRenderingSettings);

              const completeEvents = [
                google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
                google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
                google.ima.AdEvent.Type.COMPLETE,
                google.ima.AdEvent.Type.SKIPPED,
              ];

              completeEvents.forEach((eventType: string) => adsManager.addEventListener(eventType, finish));
              adsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => setLoading(false));
              adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, finish);

              const width = adContainer.clientWidth || window.innerWidth;
              const height = adContainer.clientHeight || Math.round(window.innerHeight * 0.45);

              adDisplayContainer.initialize();
              adsManager.init(width, height, google.ima.ViewMode.NORMAL);
              adsManager.start();
            } catch {
              finish();
            }
          },
        );

        adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, finish);

        const adsRequest = new google.ima.AdsRequest();
        adsRequest.adTagUrl = adTagUrl;
        adsRequest.linearAdSlotWidth = adContainer.clientWidth || window.innerWidth;
        adsRequest.linearAdSlotHeight = adContainer.clientHeight || Math.round(window.innerHeight * 0.45);
        adsRequest.nonLinearAdSlotWidth = adContainer.clientWidth || window.innerWidth;
        adsRequest.nonLinearAdSlotHeight = Math.round((adContainer.clientHeight || window.innerHeight) / 3);
        adsRequest.setAdWillAutoPlay(true);
        adsRequest.setAdWillPlayMuted(true);
        adsRequest.vastLoadTimeout = 8000;

        adsLoader.requestAds(adsRequest);
      } catch {
        finish();
      }
    };

    completedRef.current = false;
    setLoading(true);
    setupAds();

    return () => {
      destroyed = true;
      try {
        adsManager?.destroy?.();
      } catch {
        // ignore cleanup errors
      }
      try {
        adsLoader?.destroy?.();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [adTagUrl, onComplete, show]);

  if (!show || !adTagUrl) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/95">
      <div ref={containerRef} className="relative h-full w-full">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" />
        <div className="absolute left-3 top-3 rounded-full bg-secondary/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-foreground">
          {label}
        </div>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-foreground/80">
            <Loader2 size={18} className="animate-spin text-primary" />
            Loading ad…
          </div>
        )}
      </div>
    </div>
  );
};

export default ImaAdOverlay;