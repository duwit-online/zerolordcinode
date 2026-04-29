import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Loader2, Settings2, RefreshCw, SkipBack, SkipForward } from "lucide-react";

export type PlayerSource = {
  kind: "hls" | "mp4" | "iframe";
  url: string;
  label: string;
};

interface CinodePlayerProps {
  sources: PlayerSource[];
  poster?: string;
  forcedSrc?: string | null;          // for offline playback
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const STALL_TIMEOUT_MS = 18000;

const CinodePlayer = ({ sources, poster, forcedSrc, onEnded, onTimeUpdate }: CinodePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stallTimer = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualities, setQualities] = useState<{ index: number; height: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

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

  useEffect(() => { setIndex(0); setErrorMsg(null); setLoading(true); setQualities([]); setCurrentLevel(-1); }, [effectiveSources.map((s) => s.url).join("|")]);

  useEffect(() => {
    if (!current || current.kind === "iframe") return;
    const video = videoRef.current;
    if (!video) return;

    setLoading(true); setErrorMsg(null); armStall();
    video.playbackRate = playbackRate;

    const onPlaying = () => { setLoading(false); clearStall(); };
    const onWaiting = () => { setLoading(true); armStall(); };
    const onError = () => tryNext("video error");
    const onTime = () => onTimeUpdate?.(video.currentTime, video.duration || 0);
    const onEndedHandler = () => onEnded?.();

    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadeddata", onPlaying);
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
        setQualities(hls.levels.map((l, i) => ({ index: i, height: l.height || 0 })));
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setCurrentLevel(d.level));
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) tryNext(`hls ${data.type}/${data.details}`); });
    } else {
      video.src = current.url;
      video.load();
    }
    video.play().catch(() => { /* user gesture may be required */ });

    return () => {
      clearStall();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEndedHandler);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [current?.url, current?.kind, armStall, tryNext, onEnded, onTimeUpdate, playbackRate]);

  const skip = (delta: number) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime + delta); };
  const setRate = (r: number) => { setPlaybackRate(r); const v = videoRef.current; if (v) v.playbackRate = r; };
  const enterPip = async () => { const v = videoRef.current as any; if (v?.requestPictureInPicture) try { await v.requestPictureInPicture(); } catch {} };

  if (!current) return <div className="aspect-video w-full bg-black flex items-center justify-center text-muted-foreground">No playable source.</div>;

  return (
    <div className="relative w-full aspect-video bg-black overflow-hidden rounded-2xl group">
      {current.kind === "iframe" ? (
        <iframe src={current.url} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" />
      ) : (
        <video ref={videoRef} poster={poster} controls playsInline crossOrigin="anonymous" className="w-full h-full bg-black" />
      )}

      {loading && current.kind !== "iframe" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="animate-spin text-primary" size={36} />
          <p className="mt-3 text-xs text-white/80">Loading {current.label}…</p>
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

      {/* Top-right badge + controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur">{current.label}</span>
        <button onClick={() => setShowSourceMenu((v) => !v)} className="rounded-full bg-black/60 p-1.5 text-white/90 backdrop-blur hover:bg-black/80"><Settings2 size={14} /></button>
      </div>

      {/* Skip buttons (non-iframe) */}
      {current.kind !== "iframe" && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => skip(-10)} className="rounded-full bg-black/60 p-2 text-white"><SkipBack size={16} /></button>
        </div>
      )}
      {current.kind !== "iframe" && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => skip(10)} className="rounded-full bg-black/60 p-2 text-white"><SkipForward size={16} /></button>
        </div>
      )}

      {showSourceMenu && (
        <div className="absolute top-12 right-3 z-20 w-60 rounded-xl bg-black/90 backdrop-blur border border-white/10 p-3 text-white text-xs space-y-3">
          <div>
            <div className="font-bold mb-1.5 text-white/80 uppercase text-[10px]">Source</div>
            <div className="max-h-40 overflow-auto space-y-1">
              {effectiveSources.map((s, i) => (
                <button key={s.url} onClick={() => { setIndex(i); setShowSourceMenu(false); }} className={`w-full text-left rounded-md px-2 py-1.5 ${i === index ? "bg-primary text-primary-foreground" : "hover:bg-white/10"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {current.kind !== "iframe" && (
            <div>
              <div className="font-bold mb-1.5 text-white/80 uppercase text-[10px]">Speed</div>
              <div className="flex flex-wrap gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <button key={r} onClick={() => setRate(r)} className={`rounded-md px-2 py-1 ${playbackRate === r ? "bg-primary text-primary-foreground" : "bg-white/10"}`}>{r}x</button>
                ))}
              </div>
            </div>
          )}
          {qualities.length > 1 && (
            <div>
              <div className="font-bold mb-1.5 text-white/80 uppercase text-[10px]">Quality</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = -1; }} className={`rounded-md px-2 py-1 ${currentLevel === -1 ? "bg-primary text-primary-foreground" : "bg-white/10"}`}>Auto</button>
                {qualities.map((q) => (
                  <button key={q.index} onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = q.index; }} className={`rounded-md px-2 py-1 ${currentLevel === q.index ? "bg-primary text-primary-foreground" : "bg-white/10"}`}>{q.height}p</button>
                ))}
              </div>
            </div>
          )}
          {current.kind !== "iframe" && (
            <button onClick={enterPip} className="w-full rounded-md bg-white/10 hover:bg-white/20 py-1.5">Picture-in-Picture</button>
          )}
        </div>
      )}
    </div>
  );
};

export default CinodePlayer;
