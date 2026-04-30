import { useState } from "react";
import { motion } from "framer-motion";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { ListOrdered, ChevronUp, ChevronDown, Save, Loader2, Smartphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_PLAYBACK_ORDER, PLAYBACK_SOURCE_LABELS, PLAYBACK_SOURCE_KEYS, normalizePlaybackOrder } from "@/lib/playbackSources";

const AdminPlaybackSettings = () => {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [order, setOrder] = useState<string[] | null>(null);
  const [android, setAndroid] = useState<string | null>(null);
  const [ios, setIos] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const currentOrder = normalizePlaybackOrder(order ?? settings?.playback_order?.order ?? DEFAULT_PLAYBACK_ORDER);
  const links = settings?.mobile_app_links || {};
  const androidVal = android ?? links.android ?? "";
  const iosVal = ios ?? links.ios ?? "";

  const move = (i: number, dir: -1 | 1) => {
    const next = [...currentOrder];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const toggleKey = (k: string) => {
    const next = currentOrder.includes(k) ? currentOrder.filter((x) => x !== k) : [...currentOrder, k];
    setOrder(next);
  };

  const saveOrder = async () => {
    setSaving("order");
    try { await updateSetting.mutateAsync({ key: "playback_order", value: { order: currentOrder } }); toast({ title: "Playback order saved" }); setOrder(null); }
    catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    setSaving(null);
  };

  const saveLinks = async () => {
    setSaving("links");
    try { await updateSetting.mutateAsync({ key: "mobile_app_links", value: { android: androidVal, ios: iosVal } }); toast({ title: "App links saved" }); setAndroid(null); setIos(null); }
    catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    setSaving(null);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const inactive = PLAYBACK_SOURCE_KEYS.filter((k) => !currentOrder.includes(k));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2"><ListOrdered size={18} className="text-primary" /><h3 className="font-bold">Playback Source Order</h3></div>
        <p className="text-xs text-muted-foreground">Drag-free reorder using arrows. Top = tried first. Toggle sources off to skip them entirely.</p>

        <div className="space-y-1.5">
          {currentOrder.map((k, i) => (
            <div key={k} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <span className="text-xs font-mono w-5 text-muted-foreground">{i + 1}</span>
              <span className="flex-1 font-medium">{PLAYBACK_SOURCE_LABELS[k] || k}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-secondary disabled:opacity-30"><ChevronUp size={14} /></button>
              <button onClick={() => move(i, 1)} disabled={i === currentOrder.length - 1} className="p-1.5 rounded hover:bg-secondary disabled:opacity-30"><ChevronDown size={14} /></button>
              <button onClick={() => toggleKey(k)} className="text-xs text-destructive">Remove</button>
            </div>
          ))}
        </div>

        {inactive.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Disabled sources:</p>
            <div className="flex flex-wrap gap-2">
              {inactive.map((k) => (
                <button key={k} onClick={() => toggleKey(k)} className="rounded-full bg-secondary px-3 py-1 text-xs hover:bg-secondary/80">+ {PLAYBACK_SOURCE_LABELS[k] || k}</button>
              ))}
            </div>
          </div>
        )}

        <button onClick={saveOrder} disabled={!order || saving === "order"} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving === "order" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save order
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2"><Smartphone size={18} className="text-primary" /><h3 className="font-bold">Mobile App Download Links</h3></div>
        <p className="text-xs text-muted-foreground">Shown to web users when they tap Download (offline is mobile-only).</p>
        <label className="block text-xs">Android (Play Store / APK URL)</label>
        <input value={androidVal} onChange={(e) => setAndroid(e.target.value)} placeholder="https://play.google.com/..." className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm" />
        <label className="block text-xs">iOS (App Store URL)</label>
        <input value={iosVal} onChange={(e) => setIos(e.target.value)} placeholder="https://apps.apple.com/..." className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm" />
        <button onClick={saveLinks} disabled={(android === null && ios === null) || saving === "links"} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving === "links" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save links
        </button>
      </div>
    </motion.div>
  );
};

export default AdminPlaybackSettings;
