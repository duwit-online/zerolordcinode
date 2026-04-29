import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2, Play, ArrowLeft, HardDrive } from "lucide-react";
import { listOffline, deleteOffline, type OfflineMeta } from "@/lib/offlineDownloads";
import { isNative } from "@/lib/native";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getImageUrl } from "@/lib/tmdb";

const Downloads = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OfflineMeta[]>([]);
  const { data: settings } = useAppSettings();
  const links = settings?.mobile_app_links || {};

  useEffect(() => { setRows(listOffline()); }, []);
  const refresh = () => setRows(listOffline());

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this download?")) return;
    await deleteOffline(id);
    refresh();
  };

  if (!isNative()) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-24 px-4">
        <div className="max-w-md mx-auto text-center pt-12">
          <HardDrive size={48} className="mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-black mb-2">Downloads — Mobile Only</h1>
          <p className="text-sm text-muted-foreground mb-6">Offline downloads are only available in the Cinode mobile app.</p>
          <div className="space-y-2">
            {links.android && <a href={links.android} className="block rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">Get the Android app</a>}
            {links.ios && <a href={links.ios} className="block rounded-xl bg-secondary py-3 text-sm font-bold">Get the iOS app</a>}
            {!links.android && !links.ios && <p className="text-xs text-muted-foreground">Admin hasn't configured app download links yet.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-24 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft size={16} /> Back</button>
        <div className="flex items-center gap-2 mb-5"><Download className="text-primary" size={22} /><h1 className="text-2xl font-black">My Downloads</h1></div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No downloads yet. Tap "Download" on any movie's details page.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                <img src={r.posterPath ? getImageUrl(r.posterPath, "w185") : "/placeholder.svg"} alt={r.title} className="w-16 h-24 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm line-clamp-1">{r.title}</div>
                  <div className="text-[11px] uppercase text-primary mt-0.5">{r.type}{r.season ? ` • S${r.season}E${r.episode}` : ""}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{(r.bytes / (1024 * 1024)).toFixed(1)} MB • {r.sourceLabel}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => navigate(`/watch/${r.type}/${r.tmdbId}${r.season ? `?season=${r.season}&episode=${r.episode}&offline=1` : "?offline=1"}`)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                      <Play size={12} /> Play
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-destructive/15 text-destructive px-3 py-1.5 text-xs font-bold">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Downloads;
