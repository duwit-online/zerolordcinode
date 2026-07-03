import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  ChevronDown,
  Gauge,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings2,
  Volume2,
  VolumeX,
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

const formatTime = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const CinodePlayer = ({ sources, poster, forcedSrc, initialTime, onEnded, onTimeUpdate }: CinodePlayerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stallTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const seekedRef = useRef(false);

  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [menu, setMenu] = useState<null | "settings">(null);
  const [rate, setRate] = useState(1);
  const [isFs, setIsFs] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [controls, setControls] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);

  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const initialTimeRef = useRef(initialTime);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { initialTimeRef.current = initialTime; }, [initialTime]);

  const effectiveSources: PlayerSource[] = useMemo(() => (
    forcedSrc
      ? [{ kind: (forcedSrc.endsWith(".m3u8") ? "hls" : "mp4") as PlayerSource["kind"], label: "Offline", url: forcedSrc }]
      : sources
  ), [forcedSrc, sources]);
  const current = effectiveSources[index];
  const sourceKey = useMemo(() => effectiveSources.map((s) => s.url).join("|"), [effectiveSources]);

  const showControls = useCallback(() => {
    setControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setControls(false);
      setMenu(null);
    }, 3500);
  }, []);

  useEffect(() => { showControls(); return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }; }, [showControls]);

  const clearStall = () => { if (stallTimer.current) { window.clearTimeout(stallTimer.current); stallTimer.current = null; } };

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

  const armStall = useCallback(() => {
    clearStall();
    stallTimer.current = window.setTimeout(() => tryNext("Source stalled"), STALL_TIMEOUT_MS);
  }, [tryNext]);

  useEffect(() => {
    setIndex(0); setErrorMsg(null); setLoading(true); setLevels([]); setCurrentLevel(-1); setMenu(null);
    seekedRef.current = false;
  }, [sourceKey]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!current || current.kind === "iframe") return;
    const v = videoRef.current;
    if (!v) return;

    setLoading(true); setErrorMsg(null); setLevels([]); setCurrentLevel(-1); setMenu(null);
    armStall();

    const seekToInitial = () => {
      const init = initialTimeRef.current;
      if (!seekedRef.current && init && init > 5) {
        try { v.currentTime = init; } catch { /* ignore */ }
        seekedRef.current = true;
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onPlaying = () => { setLoading(false); clearStall(); seekToInitial(); };
    const onLoaded = () => { setLoading(false); clearStall(); seekToInitial(); setDuration(v.duration || 0); };
    const onWaiting = () => { setLoading(true); armStall(); };
    const onErr = () => tryNext("video error");
    const onTime = () => {
      setCurrentTime(v.currentTime);
      setDuration(v.duration || 0);
      try {
        if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
      } catch { /* ignore */ }
      onTimeUpdateRef.current?.(v.currentTime, v.duration || 0);
    };
    const onEnd = () => { setIsPlaying(false); onEndedRef.current?.(); };
    const onRate = () => setRate(v.playbackRate || 1);
    const onVol = () => { setMuted(v.muted); setVolume(v.volume); };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("error", onErr);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    v.addEventListener("ratechange", onRate);
    v.addEventListener("volumechange", onVol);

    if (current.kind === "hls" && Hls.isSupported() && !v.canPlayType("application/vnd.apple.mpegurl")) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(current.url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const lv = hls.levels
          .map((l, i) => ({ height: l.height || 0, index: i }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setLevels(lv);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) tryNext(`hls ${data.type}/${data.details}`); });
    } else {
      v.src = current.url;
      v.load();
    }

    v.play().catch(() => { /* gesture required */ });

    return () => {
      clearStall();
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("error", onErr);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("ratechange", onRate);
      v.removeEventListener("volumechange", onVol);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.url, current?.kind]);

  useEffect(() => { const v = videoRef.current; if (v) v.playbackRate = rate; }, [rate]);

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
    showControls();
  };
  const seekBy = (s: number) => {
    const v = videoRef.current; if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : Number.MAX_SAFE_INTEGER;
    v.currentTime = Math.min(Math.max(v.currentTime + s, 0), d);
    showControls();
  };
  const seekTo = (pct: number) => {
    const v = videoRef.current; if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = pct * v.duration;
  };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; showControls(); };
  const changeVolume = (val: number) => { const v = videoRef.current; if (!v) return; v.volume = val; v.muted = val === 0; };
  const pickLevel = (i: number) => { if (hlsRef.current) { hlsRef.current.currentLevel = i; setCurrentLevel(i); } setMenu(null); };
  const changeRate = (r: number) => { const v = videoRef.current; if (v) v.playbackRate = r; setRate(r); setMenu(null); };

  const togglePiP = async () => {
    const v = videoRef.current; if (!v) return;
    try {
      if (document.pictureInPictureElement === v) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await v.requestPictureInPicture();
    } catch { /* ignore */ }
  };
  const toggleFs = async () => {
    const w = wrapperRef.current; if (!w) return;
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await w.requestFullscreen(); } catch { /* ignore */ }
  };

  if (!current) {
    return <div className="flex aspect-video w-full items-center justify-center bg-black text-white/60">No playable source.</div>;
  }

  const isIframe = current.kind === "iframe";
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buffPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      onMouseMove={showControls}
      onClick={() => { if (!isIframe) { showControls(); } }}
      className="group relative h-full w-full overflow-hidden bg-black select-none"
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
          playsInline
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full bg-black object-contain"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        />
      )}

      {/* Loading */}
      {loading && !isIframe && !errorMsg && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/5 backdrop-blur-md">
            <Loader2 className="animate-spin text-white" size={28} />
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/70">Buffering</p>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
          <p className="font-semibold text-white">Playback failed</p>
          <p className="max-w-xs text-xs text-white/60">{errorMsg}</p>
          <button
            onClick={() => { setIndex(0); setErrorMsg(null); }}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black active:scale-95"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Controls overlay */}
      {!isIframe && !errorMsg && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/60 via-transparent to-black/80 transition-opacity duration-300 ${controls ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          {/* Top row */}
          <div className="flex items-start justify-end p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePiP}
                aria-label="Picture in Picture"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
              >
                <PictureInPicture2 size={16} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenu((m) => (m === "settings" ? null : "settings"))}
                  aria-label="Settings"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
                >
                  <Settings2 size={16} />
                </button>
                {menu === "settings" && (
                  <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl">
                    <div className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-2"><Gauge size={12}/> Speed</div>
                    <div className="grid grid-cols-5 gap-1 px-2 pb-2">
                      {PLAYBACK_RATES.map((r) => (
                        <button
                          key={r}
                          onClick={() => changeRate(r)}
                          className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${rate === r ? "bg-white text-black" : "bg-white/5 text-white hover:bg-white/10"}`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                    {levels.length > 0 && (
                      <>
                        <div className="border-t border-white/10 px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Quality</div>
                        <div className="max-h-48 overflow-y-auto pb-2">
                          <button
                            onClick={() => pickLevel(-1)}
                            className={`flex w-full items-center justify-between px-4 py-2 text-xs transition ${currentLevel === -1 ? "bg-white/10 font-semibold text-white" : "text-white/80 hover:bg-white/5"}`}
                          >
                            <span>Auto</span>
                            {currentLevel === -1 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </button>
                          {levels.map((l) => (
                            <button
                              key={l.index}
                              onClick={() => pickLevel(l.index)}
                              className={`flex w-full items-center justify-between px-4 py-2 text-xs transition ${currentLevel === l.index ? "bg-white/10 font-semibold text-white" : "text-white/80 hover:bg-white/5"}`}
                            >
                              <span>{l.height}p</span>
                              {currentLevel === l.index && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center controls */}
          <div className="pointer-events-none flex items-center justify-center gap-8 sm:gap-12">
            <button
              onClick={() => seekBy(-10)}
              aria-label="Back 10s"
              className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95 sm:h-14 sm:w-14"
            >
              <RotateCcw size={22} />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="pointer-events-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-2xl transition hover:scale-105 active:scale-95 sm:h-20 sm:w-20"
            >
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
            <button
              onClick={() => seekBy(10)}
              aria-label="Forward 10s"
              className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95 sm:h-14 sm:w-14"
            >
              <RotateCw size={22} />
            </button>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col gap-2 px-4 pb-4 sm:px-6 sm:pb-5">
            {/* Progress */}
            <div className="flex items-center gap-3 text-[11px] font-medium tabular-nums text-white/80">
              <span>{formatTime(currentTime)}</span>
              <div
                className="group/bar relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/15"
                onPointerDown={(e) => {
                  setScrubbing(true);
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekTo(Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1));
                }}
                onPointerMove={(e) => {
                  if (!scrubbing) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekTo(Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1));
                }}
                onPointerUp={() => setScrubbing(false)}
                onPointerLeave={() => setScrubbing(false)}
              >
                <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${buffPct}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary opacity-0 shadow-lg transition group-hover/bar:opacity-100"
                  style={{ left: `${pct}%` }}
                />
              </div>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                >
                  {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="hidden h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/15 accent-white sm:block"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(levels.length > 0 || rate !== 1) && (
                  <button
                    onClick={() => setMenu((m) => (m === "settings" ? null : "settings"))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
                  >
                    <span>{currentLevel === -1 ? "Auto" : `${levels.find((l) => l.index === currentLevel)?.height || ""}p`}</span>
                    <span className="text-white/40">·</span>
                    <span>{rate}x</span>
                    <ChevronDown size={12} />
                  </button>
                )}
                <button
                  onClick={toggleFs}
                  aria-label="Fullscreen"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                >
                  {isFs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CinodePlayer;
