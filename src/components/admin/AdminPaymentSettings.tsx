import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentMethods } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { CreditCard, Save, Plus, Trash2 } from "lucide-react";

const AdminPaymentSettings = () => {
  const { user } = useAuth();
  const { data: methods } = usePaymentMethods();
  const [form, setForm] = useState<any>({
    bank_name: "",
    account_name: "",
    account_number: "",
    crypto_wallet: "",
    other_methods: "",
    payment_note: "",
    tracking_questions: [] as string[],
    approval_message: "",
    rejection_message: "",
  });

  useEffect(() => {
    if (methods) setForm({ ...form, ...methods, tracking_questions: methods.tracking_questions || [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods]);

  const save = async () => {
    const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "payment_methods").maybeSingle();
    if (existing) {
      await supabase.from("app_settings").update({ value: form as any, updated_by: user?.id }).eq("id", existing.id);
    } else {
      await supabase.from("app_settings").insert({ key: "payment_methods", value: form as any, updated_by: user?.id });
    }
    toast.success("Payment methods saved!");
  };

  const addQuestion = () => setForm({ ...form, tracking_questions: [...(form.tracking_questions || []), ""] });
  const updateQuestion = (i: number, v: string) => {
    const next = [...(form.tracking_questions || [])];
    next[i] = v;
    setForm({ ...form, tracking_questions: next });
  };
  const removeQuestion = (i: number) => {
    const next = [...(form.tracking_questions || [])];
    next.splice(i, 1);
    setForm({ ...form, tracking_questions: next });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2"><CreditCard size={20} /> Payment Settings</h2>
      <div className="glass rounded-xl p-4 border border-border/30 space-y-3">
        {[
          { key: "bank_name", label: "Bank Name", placeholder: "e.g. GTBank" },
          { key: "account_name", label: "Account Name", placeholder: "e.g. John Doe" },
          { key: "account_number", label: "Account Number", placeholder: "e.g. 0123456789" },
          { key: "crypto_wallet", label: "Crypto Wallet (optional)", placeholder: "BTC/USDT address" },
          { key: "other_methods", label: "Other Methods (optional)", placeholder: "PayPal, etc." },
        ].map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium mb-1 block">{f.label}</label>
            <input
              value={(form as any)[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full bg-secondary/50 border border-border/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50"
            />
          </div>
        ))}

        <div>
          <label className="text-sm font-medium mb-1 block">Payment Note (shown on checkout)</label>
          <textarea
            value={form.payment_note || ""}
            onChange={(e) => setForm({ ...form, payment_note: e.target.value })}
            placeholder="Kindly transfer the total amount to the account details below using your Order ID as the payment reference."
            rows={3}
            className="w-full bg-secondary/50 border border-border/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Tracking Questions (required for users)</label>
            <button type="button" onClick={addQuestion} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary/20 text-primary">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {(form.tracking_questions || []).map((q: string, i: number) => (
              <div key={i} className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => updateQuestion(i, e.target.value)}
                  placeholder={`Question ${i + 1} (e.g. Sender phone number)`}
                  className="flex-1 bg-secondary/50 border border-border/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
                <button type="button" onClick={() => removeQuestion(i)} className="p-2 rounded-xl bg-red-500/10 text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {(!form.tracking_questions || form.tracking_questions.length === 0) && (
              <p className="text-xs text-muted-foreground">No tracking questions. Click "Add" to create one.</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Approval Message Template</label>
          <textarea
            value={form.approval_message || ""}
            onChange={(e) => setForm({ ...form, approval_message: e.target.value })}
            placeholder="🎉 Your payment has been approved! Your subscription is now active. Enjoy!"
            rows={2}
            className="w-full bg-secondary/50 border border-border/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Rejection Message Template</label>
          <textarea
            value={form.rejection_message || ""}
            onChange={(e) => setForm({ ...form, rejection_message: e.target.value })}
            placeholder="Sorry, your payment could not be verified. Please review and resubmit."
            rows={2}
            className="w-full bg-secondary/50 border border-border/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 resize-none"
          />
        </div>

        <button onClick={save} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          <Save size={14} /> Save Payment Details
        </button>
      </div>
    </div>
  );
};

export default AdminPaymentSettings;
