import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link2, Plus, Trash2, Edit2, Save, X, Play, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Override {
  id: string; tmdb_id: string; media_type: string;
  custom_url: string | null; custom_title: string | null;
  season: number | null; episode: number | null;
}

const blank: Partial<Override> = { tmdb_id: "", media_type: "movie", custom_url: "", custom_title: "" };

const AdminOverrides = () => {
  const [rows, setRows] = useState<Override[]>([]);
  const [editing, setEditing] = useState<Partial<Override> | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("movie_overrides").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message });
    setRows((data as Override[]) || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.tmdb_id || !editing?.custom_url) { toast({ title: "TMDB ID and URL required" }); return; }
    const payload: any = { ...editing };
    const { error } = editing.id
      ? await supabase.from("movie_overrides").update(payload).eq("id", editing.id)
      : await supabase.from("movie_overrides").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message }); return; }
    toast({ title: "Saved" }); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this override?")) return;
    const { error } = await supabase.from("movie_overrides").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message }); return; }
    load();
  };

  const duplicate = async (r: Override) => {
    const { id, ...rest } = r;
    const { error } = await supabase.from("movie_overrides").insert(rest as any);
    if (error) toast({ title: "Failed", description: error.message }); else { toast({ title: "Duplicated" }); load(); }
  };

  const testPlay = (r: Override) => {
    if (!r.custom_url) return;
    window.open(r.custom_url, "_blank");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Link2 size={18} className="text-primary" /><h2 className="text-lg font-bold">Source Overrides</h2></div>
        <button onClick={() => setEditing({ ...blank })} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus size={14} /> Add</button>
      </div>
      <p className="text-xs text-muted-foreground">Override the playback URL for a specific movie or episode. Supports .m3u8, .mp4 or iframe-embed URLs.</p>

      {editing && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input type="text" className="rounded-xl bg-background border border-border px-3 py-2 text-sm" placeholder="Jellyfin Item ID" value={editing.tmdb_id || ""} onChange={(e) => setEditing({ ...editing, tmdb_id: e.target.value })} />
            <select className="rounded-xl bg-background border border-border px-3 py-2 text-sm" value={editing.media_type || "movie"} onChange={(e) => setEditing({ ...editing, media_type: e.target.value })}>
              <option value="movie">Movie</option>
              <option value="tv">TV</option>
            </select>
            {editing.media_type === "tv" && (<>
              <input type="number" className="rounded-xl bg-background border border-border px-3 py-2 text-sm" placeholder="Season" value={editing.season ?? ""} onChange={(e) => setEditing({ ...editing, season: Number(e.target.value) })} />
              <input type="number" className="rounded-xl bg-background border border-border px-3 py-2 text-sm" placeholder="Episode" value={editing.episode ?? ""} onChange={(e) => setEditing({ ...editing, episode: Number(e.target.value) })} />
            </>)}
            <input className="rounded-xl bg-background border border-border px-3 py-2 text-sm sm:col-span-2" placeholder="Title (optional)" value={editing.custom_title || ""} onChange={(e) => setEditing({ ...editing, custom_title: e.target.value })} />
            <input className="rounded-xl bg-background border border-border px-3 py-2 text-sm sm:col-span-2" placeholder="Playback URL" value={editing.custom_url || ""} onChange={(e) => setEditing({ ...editing, custom_url: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Save size={14} /> Save</button>
            <button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No overrides yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{r.custom_title || `TMDB #${r.tmdb_id}`} <span className="ml-2 text-[10px] uppercase text-primary">{r.media_type}{r.season ? ` S${r.season}E${r.episode}` : ""}</span></div>
              <div className="text-xs text-muted-foreground truncate">{r.custom_url}</div>
            </div>
            <div className="flex gap-1">
              <button title="Test play" onClick={() => testPlay(r)} className="p-2 rounded-lg hover:bg-secondary text-primary"><Play size={14} /></button>
              <button title="Duplicate" onClick={() => duplicate(r)} className="p-2 rounded-lg hover:bg-secondary"><Copy size={14} /></button>
              <button onClick={() => setEditing(r)} className="p-2 rounded-lg hover:bg-secondary"><Edit2 size={14} /></button>
              <button onClick={() => remove(r.id)} className="p-2 rounded-lg hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default AdminOverrides;
