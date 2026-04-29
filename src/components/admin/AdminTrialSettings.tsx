import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTrialSettings } from "@/hooks/useTrialSettings";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Gift, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AdminTrialSettings = () => {
  const { user } = useAuth();
  const { data: settings } = useTrialSettings();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    enabled: true,
    days: 1,
    note: "",
    show_notification: true,
    show_modal: true,
    show_banner: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "trial_settings").maybeSingle();
      if (existing) {
        await supabase.from("app_settings").update({ value: form as any, updated_by: user?.id }).eq("id", existing.id);
      } else {
        await supabase.from("app_settings").insert({ key: "trial_settings", value: form as any, updated_by: user?.id });
      }
      toast.success("Trial settings saved");
      qc.invalidateQueries({ queryKey: ["trial-settings"] });
      qc.invalidateQueries({ queryKey: ["appSettings"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2"><Gift size={20} /> Free Trial Settings</h2>

      <div className="glass rounded-xl p-4 border border-border/30 space-y-4">
        <p className="text-xs text-muted-foreground">
          Configure the free trial granted automatically on signup. Existing users are not affected.
        </p>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm font-medium">Enable free trial on signup</span>
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-5 h-5 accent-primary" />
        </label>

        <div>
          <label className="text-sm font-medium block mb-1">Trial duration (days)</label>
          <input
            type="number"
            min={0}
            value={form.days}
            onChange={(e) => setForm({ ...form, days: Math.max(0, Number(e.target.value)) })}
            className="w-32 bg-secondary/50 border border-border/30 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Trial welcome message</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            rows={4}
            placeholder="Welcome to Cinode! You have a free trial. Upgrade anytime to keep enjoying premium content."
            className="w-full bg-secondary/50 border border-border/30 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Where to show the welcome message</p>
          {[
            { key: "show_notification", label: "Send as notification (bell icon)" },
            { key: "show_modal", label: "Popup modal on first signup" },
            { key: "show_banner", label: "Sticky banner across the app" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">{label}</span>
              <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="w-5 h-5 accent-primary" />
            </label>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Trial Settings
        </button>
      </div>
    </div>
  );
};

export default AdminTrialSettings;
