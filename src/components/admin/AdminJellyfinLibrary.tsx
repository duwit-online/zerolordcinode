import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Library, Search, RefreshCw, ChevronLeft, ChevronRight, Loader2, Play, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Server { id: string; name: string; }
interface Item {
  id: string; name: string; year?: number; type: string; tmdbId?: string | null;
  imdbId?: string | null; genres: string[]; addedAt?: string; runtimeMinutes?: number | null; overview?: string;
}

const AdminJellyfinLibrary = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [serverId, setServerId] = useState<string>("");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testingPlay, setTestingPlay] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("streaming_servers").select("id,name").eq("is_enabled", true).eq("server_type", "jellyfin");
      setServers(data || []);
      if (data?.[0]) setServerId(data[0].id);
    })();
  }, []);

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || ANON;
    return { apikey: ANON, Authorization: `Bearer ${token}` } as Record<string, string>;
  };

  const load = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ serverId, type, page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/jellyfin-proxy/library?${params}`, {
        headers: await authHeaders(),
      });
      const text = await res.text();
      let j: any = null;
      try { j = text ? JSON.parse(text) : {}; }
      catch {
        toast({ title: "Load failed", description: `Server returned non-JSON (${res.status}). ${text.slice(0, 120)}`, variant: "destructive" });
        setItems([]); setLoading(false); return;
      }
      if (!res.ok || j.error) { toast({ title: "Load failed", description: j.error || `HTTP ${res.status}`, variant: "destructive" }); setItems([]); }
      else { setItems(j.items || []); setTotal(j.total || 0); }
    } catch (e: any) { toast({ title: "Load failed", description: e.message, variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [serverId, type, page]);

  const testPlay = async (it: Item) => {
    setTestingPlay(it.id);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/jellyfin-proxy/test-play?serverId=${serverId}&itemId=${it.id}`, {
        headers: await authHeaders(),
      });
      const text = await res.text();
      let j: any = null;
      try { j = text ? JSON.parse(text) : {}; }
      catch { toast({ title: "Test play failed", description: `Non-JSON response (${res.status})`, variant: "destructive" }); return; }
      if (j.directUrl) window.open(j.directUrl, "_blank");
      else toast({ title: "No playback URL", description: j.error, variant: "destructive" });
    } finally { setTestingPlay(null); }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-2"><Library size={18} className="text-primary" /><h2 className="text-lg font-bold">Jellyfin Library Browser</h2></div>

      <div className="flex flex-wrap gap-2">
        <select value={serverId} onChange={(e) => { setServerId(e.target.value); setPage(1); }} className="rounded-xl bg-background border border-border px-3 py-2 text-sm">
          {servers.length === 0 && <option value="">No servers</option>}
          {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value as any); setPage(1); }} className="rounded-xl bg-background border border-border px-3 py-2 text-sm">
          <option value="movie">Movies</option>
          <option value="tv">TV Series</option>
        </select>
        <div className="flex-1 min-w-[200px] flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())} placeholder="Search title..." className="flex-1 rounded-xl bg-background border border-border px-3 py-2 text-sm" />
          <button onClick={() => { setPage(1); load(); }} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground inline-flex items-center gap-1"><Search size={14} /> Search</button>
        </div>
        <button onClick={load} className="rounded-xl bg-secondary px-3 py-2 text-sm inline-flex items-center gap-1"><RefreshCw size={14} /> Reload</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No items returned. Pick a server, or this library may be empty.</p>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">Showing {items.length} of {total} • Page {page}/{totalPages}</div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Year</th>
                  <th className="px-3 py-2 text-left">TMDB ID</th>
                  <th className="px-3 py-2 text-left">Genres</th>
                  <th className="px-3 py-2 text-left">Runtime</th>
                  <th className="px-3 py-2 text-left">Added</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-3 py-2 font-semibold">{it.name}</td>
                    <td className="px-3 py-2">{it.year || "—"}</td>
                    <td className="px-3 py-2">
                      {it.tmdbId ? (
                        <button onClick={() => { navigator.clipboard.writeText(String(it.tmdbId)); toast({ title: "Copied" }); }} className="inline-flex items-center gap-1 text-primary hover:underline">
                          {it.tmdbId} <Copy size={11} />
                        </button>
                      ) : <span className="text-muted-foreground">missing</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">{it.genres?.slice(0, 3).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{it.runtimeMinutes ? `${it.runtimeMinutes}m` : "—"}</td>
                    <td className="px-3 py-2 text-xs">{it.addedAt ? new Date(it.addedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => testPlay(it)} disabled={testingPlay === it.id} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                        {testingPlay === it.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Test Play
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg bg-secondary px-3 py-1.5 text-sm disabled:opacity-40"><ChevronLeft size={14} /></button>
            <span className="text-xs">Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg bg-secondary px-3 py-1.5 text-sm disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default AdminJellyfinLibrary;
