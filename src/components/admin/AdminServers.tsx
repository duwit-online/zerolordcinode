import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Server, Plus, Trash2, Edit2, Save, X, Power, Copy, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface JfServer {
  id: string; name: string; server_url: string; api_key_encrypted: string;
  server_type: string; is_enabled: boolean; priority: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const blank: Partial<JfServer> = { name: "", server_url: "", api_key_encrypted: "", server_type: "jellyfin", is_enabled: true, priority: 0 };

const AdminServers = () => {
  const [rows, setRows] = useState<JfServer[]>([]);
  const [editing, setEditing] = useState<Partial<JfServer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<JfServer | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("streaming_servers").select("*").order("priority", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message });
    setRows((data as JfServer[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.server_url || !editing?.api_key_encrypted) {
      toast({ title: "Missing fields", description: "Name, URL and API key are required" }); return;
    }
    const payload = { ...editing };
    const { error } = editing.id
      ? await supabase.from("streaming_servers").update(payload).eq("id", editing.id)
      : await supabase.from("streaming_servers").insert(payload as any);
    if (error) { toast({ title: "Save failed", description: error.message }); return; }
    toast({ title: "Saved" }); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this server?")) return;
    const { error } = await supabase.from("streaming_servers").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message }); return; }
    load();
  };

  const toggle = async (r: JfServer) => {
    const { error } = await supabase.from("streaming_servers").update({ is_enabled: !r.is_enabled }).eq("id", r.id);
    if (error) toast({ title: "Failed", description: error.message }); else load();
  };

  const duplicate = async (r: JfServer) => {
    const { id, ...rest } = r;
    const { error } = await supabase.from("streaming_servers").insert({ ...rest, name: `${r.name} (copy)` } as any);
    if (error) toast({ title: "Duplicate failed", description: error.message }); else { toast({ title: "Duplicated" }); load(); }
  };

  const testConnection = async (r: JfServer) => {
    setTesting(r.id);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/jellyfin-proxy/test?serverId=${r.id}`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      const j = await res.json();
      setTestResult((p) => ({ ...p, [r.id]: { ok: !!j.ok, msg: j.ok ? `${j.serverName || "OK"} • v${j.version || ""}` : (j.error || "Failed") } }));
    } catch (e: any) {
      setTestResult((p) => ({ ...p, [r.id]: { ok: false, msg: e.message } }));
    }
    setTesting(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Server size={18} className="text-primary" /><h2 className="text-lg font-bold">Streaming Servers (Jellyfin)</h2></div>
        <button onClick={() => setEditing({ ...blank })} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus size={14} /> Add</button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="rounded-xl bg-background border border-border px-3 py-2 text-sm" placeholder="Name" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <input className="rounded-xl bg-background border border-border px-3 py-2 text-sm" placeholder="Server URL (https://jellyfin.example.com)" value={editing.server_url || ""} onChange={(e) => setEditing({ ...editing, server_url: e.target.value })} />
            <input className="rounded-xl bg-background border border-border px-3 py-2 text-sm sm:col-span-2" placeholder="API key (X-Emby-Token)" value={editing.api_key_encrypted || ""} onChange={(e) => setEditing({ ...editing, api_key_encrypted: e.target.value })} />
            <input type="number" className="rounded-xl bg-background border border-border px-3 py-2 text-sm" placeholder="Priority" value={editing.priority ?? 0} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_enabled} onChange={(e) => setEditing({ ...editing, is_enabled: e.target.checked })} /> Enabled</label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Save size={14} /> Save</button>
            <button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">No servers configured. Add one to enable Jellyfin playback.</p>}
        {rows.map((r) => {
          const tr = testResult[r.id];
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {r.name}
                    <span className={`text-[10px] uppercase ${r.is_enabled ? "text-green-500" : "text-red-500"}`}>{r.is_enabled ? "ON" : "OFF"}</span>
                    {tr && (tr.ok ? <CheckCircle2 size={14} className="text-green-500" /> : <AlertCircle size={14} className="text-destructive" />)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.server_url}</div>
                  {tr && <div className={`text-[11px] mt-1 ${tr.ok ? "text-green-500" : "text-destructive"}`}>{tr.msg}</div>}
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  <button title="Test" onClick={() => testConnection(r)} className="p-2 rounded-lg hover:bg-secondary">{testing === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}</button>
                  <button title="Toggle" onClick={() => toggle(r)} className="p-2 rounded-lg hover:bg-secondary"><Power size={14} /></button>
                  <button title="Duplicate" onClick={() => duplicate(r)} className="p-2 rounded-lg hover:bg-secondary"><Copy size={14} /></button>
                  <button title="Details" onClick={() => setDetails(r)} className="p-2 rounded-lg hover:bg-secondary text-xs">Details</button>
                  <button title="Edit" onClick={() => setEditing(r)} className="p-2 rounded-lg hover:bg-secondary"><Edit2 size={14} /></button>
                  <button title="Delete" onClick={() => remove(r.id)} className="p-2 rounded-lg hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {details && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetails(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-5 max-w-md w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">{details.name}</h3>
              <button onClick={() => setDetails(null)}><X size={16} /></button>
            </div>
            <dl className="text-xs space-y-2">
              <div><dt className="text-muted-foreground">Type</dt><dd className="font-mono">{details.server_type}</dd></div>
              <div><dt className="text-muted-foreground">URL</dt><dd className="font-mono break-all">{details.server_url}</dd></div>
              <div><dt className="text-muted-foreground">API Key</dt><dd className="font-mono break-all">{details.api_key_encrypted.slice(0, 6)}…{details.api_key_encrypted.slice(-4)}</dd></div>
              <div><dt className="text-muted-foreground">Priority</dt><dd>{details.priority}</dd></div>
              <div><dt className="text-muted-foreground">Status</dt><dd>{details.is_enabled ? "Enabled" : "Disabled"}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminServers;
