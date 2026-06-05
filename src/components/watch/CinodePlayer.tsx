import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  FastForward,
  Loader2,
  Maximize,
  Minimize,
  MonitorUp,
  RefreshCw,
  Rewind,
  Settings,
} from "lucide-react";

export type PlayerSource = {
  kind: "hls" | "mp4" | "iframe";
  url: string;
  label: string;
};

interface CinodePlayerProps {
  sources: PlayerSource[];
  poster?: string;
  forcedSrc?: string | null;
  initialTime?: number;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const STALL_TIMEOUT_MS = 18000;
const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2];

const CinodePlayer = ({ sources, poster, forcedSrc, initialTime, onEnded, onTimeUpdate }: CinodePlayerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stallTimer = useRef<number | null>(null);
  const seekedRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [openMenu, setOpenMenu] = useState<null | "quality" | "speed">(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);

  // Keep callbacks in refs so the playback effect doesn't re-run on every parent render
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const initialTimeRef = useRef(initialTime);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { initialTimeRef.current = initialTime; }, [initialTime]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
      setOpenMenu(null);
    }, 3000);
  }, []);

  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      setControlsVisible(false);
      setOpenMenu(null);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    } else {
      showControls();
    }
  }, [controlsVisible, showControls]);

  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);

  const effectiveSources: PlayerSource[] = useMemo(() => (
    forcedSrc
      ? [{ kind: (forcedSrc.endsWith(".m3u8") ? "hls" : "mp4") as PlayerSource["kind"], label: "Offline", url: forcedSrc }]
      : sources
  ), [forcedSrc, sources]);
  const current = effectiveSources[index];
  const sourceKey = useMemo(() => effectiveSources.map((source) => source.url).join("|"), [effectiveSources]);

  const clearStall = () => {
    if (stallTimer.current) {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
  };

  const tryNext = useCallback((reason: string) => {
    clearStall();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIndex((currentIndex) => {
      if (currentIndex + 1 >= effectiveSources.length) {
        setErrorMsg(`No more sources. Last error: ${reason}`);
        setLoading(false);
        return currentIndex;
      }
      setLoading(true);
      setErrorMsg(null);
      return currentIndex + 1;
    });
  }, [effectiveSources.length]);

  const armStall = useCallback(() => {
    clearStall();
    stallTimer.current = window.setTimeout(() => tryNext("Source stalled"), STALL_TIMEOUT_MS);
  }, [tryNext]);

  useEffect(() => {
    setIndex(0);
    setErrorMsg(null);
    setLoading(true);
    setLevels([]);
    setCurrentLevel(-1);
    setOpenMenu(null);
    seekedRef.current = false;
  }, [sourceKey]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!current || current.kind === "iframe") return;
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setErrorMsg(null);
    setLevels([]);
    setCurrentLevel(-1);
    setOpenMenu(null);
    armStall();

    const seekToInitial = () => {
      if (!seekedRef.current && initialTime && initialTime > 5) {
        try { video.currentTime = initialTime; } catch { /* ignore */ }
        seekedRef.current = true;
      }
    };

    const onPlaying = () => { setLoading(false); clearStall(); seekToInitial(); };
    const onLoaded = () => { setLoading(false); clearStall(); seekToInitial(); };
    const onWaiting = () => { setLoading(true); armStall(); };
    const onError = () => tryNext("video error");
    const onTime = () => onTimeUpdate?.(video.currentTime, video.duration || 0);
    const onEndedHandler = () => onEnded?.();
    const onRateChange = () => setPlaybackRate(video.playbackRate || 1);

    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEndedHandler);
    video.addEventListener("ratechange", onRateChange);

    if (current.kind === "hls" && Hls.isSupported() && !video.canPlayType("application/vnd.apple.mpegurl")) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(current.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const availableLevels = hls.levels
          .map((level, levelIndex) => ({ height: level.height || 0, index: levelIndex }))
          .filter((level) => level.height > 0)
          .sort((a, b) => b.height - a.height);
        setLevels(availableLevels);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) tryNext(`hls ${data.type}/${data.details}`);
      });
    } else {
      video.src = current.url;
      video.load();
    }

    video.playbackRate = playbackRate;
    video.play().catch(() => { /* gesture required */ });

    return () => {
      clearStall();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEndedHandler);
      video.removeEventListener("ratechange", onRateChange);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [armStall, current, initialTime, onEnded, onTimeUpdate, playbackRate, tryNext]);

  const pickLevel = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
    }
    setOpenMenu(null);
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), duration);
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setOpenMenu(null);
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch { /* ignore */ }
  };

  const toggleFullscreen = async () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await wrapper.requestFullscreen();
      }
    } catch { /* ignore */ }
  };

  if (!current) {
    return <div className="flex aspect-video w-full items-center justify-center bg-background text-muted-foreground">No playable source.</div>;
  }

  const isIframe = current.kind === "iframe";

  return (
    <div
      ref={wrapperRef}
      onClick={() => !isIframe && toggleControls()}
      className={`group relative w-full overflow-hidden bg-background ${isFullscreen ? "h-screen" : "aspect-video rounded-2xl"}`}
    >
      {isIframe ? (
        <iframe
          src={current.url}
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      ) : (
        <video
          ref={videoRef}
          poster={poster}
          controls
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture={false}
          playsInline
          crossOrigin="anonymous"
          className="h-full w-full bg-background"
        />
      )}

      {loading && !isIframe && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-background/40">
          <Loader2 className="animate-spin text-primary" size={36} />
          <p className="mt-3 text-xs text-foreground/80">Loading video…</p>
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 px-6 text-center">
          <p className="mb-2 font-semibold text-foreground">Playback failed</p>
          <p className="mb-4 text-xs text-muted-foreground">{errorMsg}</p>
          <button
            type="button"
            onClick={() => { setIndex(0); setErrorMsg(null); }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {!isIframe && !errorMsg && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute inset-0 transition-opacity duration-200 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          {/* Center skip controls */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto flex items-center gap-4 sm:gap-8">
              <button
                type="button"
                onClick={() => seekBy(-10)}
                aria-label="Back 10 seconds"
                className="inline-flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-background/50 text-foreground backdrop-blur-sm transition hover:bg-background/80 active:scale-95"
              >
                <Rewind className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <button
                type="button"
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                className="inline-flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-background/50 text-foreground backdrop-blur-sm transition hover:bg-background/80 active:scale-95"
              >
                <FastForward className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>

          {/* Top-right unified control cluster */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            {levels.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu((m) => (m === "quality" ? null : "quality"))}
                  aria-label="Quality"
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-background/70 px-2.5 text-[11px] font-semibold text-foreground backdrop-blur-sm transition hover:bg-background/90"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>{currentLevel === -1 ? "Auto" : `${levels.find((l) => l.index === currentLevel)?.height || ""}p`}</span>
                </button>
                {openMenu === "quality" && (
                  <div className="absolute right-0 top-10 max-h-60 min-w-[110px] overflow-y-auto rounded-lg border border-border bg-background/95 shadow-xl">
                    <button
                      type="button"
                      onClick={() => pickLevel(-1)}
                      className={`w-full px-3 py-2 text-left text-xs transition hover:bg-accent ${currentLevel === -1 ? "bg-accent font-semibold" : ""}`}
                    >
                      Auto
                    </button>
                    {levels.map((level) => (
                      <button
                        key={level.index}
                        type="button"
                        onClick={() => pickLevel(level.index)}
                        className={`w-full px-3 py-2 text-left text-xs transition hover:bg-accent ${currentLevel === level.index ? "bg-accent font-semibold" : ""}`}
                      >
                        {level.height}p
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === "speed" ? null : "speed"))}
                aria-label="Playback speed"
                className="inline-flex h-8 min-w-[2.75rem] items-center justify-center rounded-full bg-background/70 px-2 text-[11px] font-semibold text-foreground backdrop-blur-sm transition hover:bg-background/90"
              >
                {playbackRate}x
              </button>
              {openMenu === "speed" && (
                <div className="absolute right-0 top-10 min-w-[90px] overflow-hidden rounded-lg border border-border bg-background/95 shadow-xl">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changePlaybackRate(rate)}
                      className={`w-full px-3 py-2 text-left text-xs transition hover:bg-accent ${playbackRate === rate ? "bg-accent font-semibold" : ""}`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={togglePictureInPicture}
              aria-label="Picture in Picture"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur-sm transition hover:bg-background/90"
            >
              <MonitorUp className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur-sm transition hover:bg-background/90"
            >
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CinodePlayer;
