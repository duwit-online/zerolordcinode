import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { FastForward, Loader2, MonitorUp, RefreshCw, Rewind, Settings } from "lucide-react";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stallTimer = useRef<number | null>(null);
  const seekedRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showQuality, setShowQuality] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const effectiveSources: PlayerSource[] = forcedSrc
    ? [{ kind: forcedSrc.endsWith(".m3u8") ? "hls" : "mp4", label: "Offline", url: forcedSrc }]
    : sources;
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
    setShowQuality(false);
    setShowSpeed(false);
    seekedRef.current = false;
  }, [sourceKey]);

  useEffect(() => {
    if (!current || current.kind === "iframe") {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setLevels([]);
    setCurrentLevel(-1);
    setShowQuality(false);
    setShowSpeed(false);
    armStall();

    const seekToInitial = () => {
      if (!seekedRef.current && initialTime && initialTime > 5) {
        try {
          video.currentTime = initialTime;
        } catch {
          // ignore seek issues
        }
        seekedRef.current = true;
      }
    };

    const onPlaying = () => {
      setLoading(false);
      clearStall();
      seekToInitial();
    };
    const onLoaded = () => {
      setLoading(false);
      clearStall();
      seekToInitial();
    };
    const onWaiting = () => {
      setLoading(true);
      armStall();
    };
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
        if (data.fatal) {
          tryNext(`hls ${data.type}/${data.details}`);
        }
      });
    } else {
      video.src = current.url;
      video.load();
    }

    video.playbackRate = playbackRate;
    video.play().catch(() => {
      // user gesture may be required
    });

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
    setShowQuality(false);
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), duration);
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
    }
    setPlaybackRate(rate);
    setShowSpeed(false);
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) {
      return;
    }

    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
        return;
      }

      await video.requestPictureInPicture();
    } catch {
      // ignore unsupported/browser gesture issues
    }
  };

  if (!current) {
    return <div className="flex aspect-video w-full items-center justify-center bg-background text-muted-foreground">No playable source.</div>;
  }

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-background">
      {current.kind === "iframe" ? (
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
          controlsList="nodownload"
          playsInline
          crossOrigin="anonymous"
          className="h-full w-full bg-background"
        />
      )}

      {loading && current.kind !== "iframe" && (
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
            onClick={() => {
              setIndex(0);
              setErrorMsg(null);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {current.kind !== "iframe" && !errorMsg && (
        <>
          {/* Centered skip buttons - tighter spacing, responsive sizing */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="pointer-events-auto flex items-center gap-3 sm:gap-6">
              <button
                type="button"
                onClick={() => seekBy(-10)}
                aria-label="Back 10 seconds"
                className="inline-flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur-sm transition hover:bg-background/90 active:scale-95"
              >
                <Rewind size={16} className="sm:hidden" />
                <Rewind size={20} className="hidden sm:block" />
              </button>
              <button
                type="button"
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                className="inline-flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur-sm transition hover:bg-background/90 active:scale-95"
              >
                <FastForward size={16} className="sm:hidden" />
                <FastForward size={20} className="hidden sm:block" />
              </button>
            </div>
          </div>

          {/* Unified top-right control cluster: quality, speed, PiP */}
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
            {levels.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuality((open) => !open);
                    setShowSpeed(false);
                  }}
                  aria-label="Quality"
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-background/70 px-2.5 text-[11px] font-semibold text-foreground backdrop-blur-sm transition hover:bg-background/90"
                >
                  <Settings size={13} />
                  <span>{currentLevel === -1 ? "Auto" : `${levels.find((l) => l.index === currentLevel)?.height || ""}p`}</span>
                </button>
                {showQuality && (
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
                onClick={() => {
                  setShowSpeed((open) => !open);
                  setShowQuality(false);
                }}
                aria-label="Playback speed"
                className="inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-full bg-background/70 px-2 text-[11px] font-semibold text-foreground backdrop-blur-sm transition hover:bg-background/90"
              >
                {playbackRate}x
              </button>
              {showSpeed && (
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
              <MonitorUp size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CinodePlayer;