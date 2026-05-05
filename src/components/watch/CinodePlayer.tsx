import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Loader2, RefreshCw, Settings, Play, Pause, Rewind, FastForward } from "lucide-react";

export type PlayerSource = {
  kind: "hls" | "mp4" | "iframe";
  url: string;
  label: string;
};

interface CinodePlayerProps {
  sources: PlayerSource[];
  poster?: string;
  forcedSrc?: string | null;          // for offline playback
  initialTime?: number;               // resume position (seconds)
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const STALL_TIMEOUT_MS = 18000;

const CinodePlayer = ({ sources, poster, forcedSrc, initialTime, onEnded, onTimeUpdate }: CinodePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stallTimer = useRef<number | null>(null);
  const seekedRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = auto
  const [showQuality, setShowQuality] = useState(false);

  const effectiveSources: PlayerSource[] = forcedSrc
    ? [{ kind: forcedSrc.endsWith(".m3u8") ? "hls" : "mp4", label: "Offline", url: forcedSrc }]
    : sources;
  const current = effectiveSources[index];

  const clearStall = () => { if (stallTimer.current) { window.clearTimeout(stallTimer.current); stallTimer.current = null; } };
  const armStall = useCallback(() => {
    clearStall();
    stallTimer.current = window.setTimeout(() => tryNext("Source stalled"), STALL_TIMEOUT_MS);
  }, []);

  const tryNext = useCallback((reason: string) => {
    clearStall();
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setIndex((i) => {
      if (i + 1 >= effectiveSources.length) {
        setErrorMsg(`No more sources. Last error: ${reason}`);
        setLoading(false);
        return i;
      }
      setLoading(true); setErrorMsg(null);
      return i + 1;
    });
  }, [effectiveSources.length]);

  useEffect(() => { setIndex(0); setErrorMsg(null); setLoading(true); seekedRef.current = false; }, [effectiveSources.map((s) => s.url).join("|")]);

  useEffect(() => {
    if (!current || current.kind === "iframe") return;
    const video = videoRef.current;
    if (!video) return;

    setLoading(true); setErrorMsg(null); setLevels([]); setCurrentLevel(-1); armStall();

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

    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEndedHandler);

    if (current.kind === "hls" && Hls.isSupported() && !video.canPlayType("application/vnd.apple.mpegurl")) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(current.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const lvls = hls.levels.map((l, i) => ({ height: l.height || 0, index: i }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setLevels(lvls);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) tryNext(`hls ${data.type}/${data.details}`); });
    } else {
      video.src = current.url;
      video.load();
    }
    video.play().catch(() => { /* user gesture may be required */ });

    return () => {
      clearStall();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEndedHandler);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [current?.url, current?.kind, armStall, tryNext, onEnded, onTimeUpdate, initialTime]);

  const pickLevel = (lvl: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvl;
      setCurrentLevel(lvl);
    }
    setShowQuality(false);
  };

  if (!current) return <div className="aspect-video w-full bg-black flex items-center justify-center text-muted-foreground">No playable source.</div>;

  return (
    <div className="relative w-full aspect-video bg-black overflow-hidden rounded-2xl group">
      {current.kind === "iframe" ? (
        <iframe src={current.url} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="no-referrer" />
      ) : (
        <video
          ref={videoRef}
          poster={poster}
          controls
          controlsList="nodownload"
          playsInline
          crossOrigin="anonymous"
          className="w-full h-full bg-black"
        />
      )}

      {/* Center skip + play overlay (non-iframe) */}
      {current.kind !== "iframe" && !errorMsg && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-16 flex items-center justify-center gap-10 md:gap-16 opacity-0 group-hover:opacity-100 transition">
          <button
            type="button"
            aria-label="Rewind 10 seconds"
            onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10); }}
            className="pointer-events-auto rounded-full bg-black/60 hover:bg-black/80 p-3 text-white"
          >
            <Rewind size={22} />
          </button>
          <button
            type="button"
            aria-label="Play/Pause"
            onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) v.play(); else v.pause(); }}
            className="pointer-events-auto rounded-full bg-primary/90 hover:bg-primary p-4 text-primary-foreground"
          >
            {videoRef.current?.paused ? <Play size={26} className="ml-0.5" /> : <Pause size={26} />}
          </button>
          <button
            type="button"
            aria-label="Forward 10 seconds"
            onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); }}
            className="pointer-events-auto rounded-full bg-black/60 hover:bg-black/80 p-3 text-white"
          >
            <FastForward size={22} />
          </button>
        </div>
      )}

      {loading && current.kind !== "iframe" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="animate-spin text-primary" size={36} />
          <p className="mt-3 text-xs text-white/80">Loading video…</p>
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center px-6">
          <p className="text-white font-semibold mb-2">Playback failed</p>
          <p className="text-white/70 text-xs mb-4">{errorMsg}</p>
          <button onClick={() => { setIndex(0); setErrorMsg(null); }} className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold inline-flex items-center gap-2">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Quality selector (HLS only) */}
      {current.kind !== "iframe" && levels.length > 0 && (
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => setShowQuality((s) => !s)}
            aria-label="Quality"
            className="rounded-full bg-black/60 hover:bg-black/80 p-2 text-white inline-flex items-center gap-1"
          >
            <Settings size={16} />
            <span className="text-xs font-semibold">
              {currentLevel === -1 ? "Auto" : `${levels.find((l) => l.index === currentLevel)?.height || ""}p`}
            </span>
          </button>
          {showQuality && (
            <div className="mt-2 min-w-[140px] rounded-xl bg-black/90 border border-white/10 overflow-hidden">
              <button
                onClick={() => pickLevel(-1)}
                className={`w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 ${currentLevel === -1 ? "bg-white/10 font-semibold" : ""}`}
              >
                Auto
              </button>
              {levels.map((l) => (
                <button
                  key={l.index}
                  onClick={() => pickLevel(l.index)}
                  className={`w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 ${currentLevel === l.index ? "bg-white/10 font-semibold" : ""}`}
                >
                  {l.height}p
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CinodePlayer;
