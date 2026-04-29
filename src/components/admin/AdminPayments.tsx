import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentMethods } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { Check, X, Eye, Clock, DollarSign, Calendar } from "lucide-react";
import { Calendar as DateCalendar } from "@/components/ui/calendar";

const sameDay = (input: string, date?: Date) => {
  if (!date) return true;
  const current = new Date(input);
  return current.toDateString() === date.toDateString();
};

const AdminPayments = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: methods } = usePaymentMethods();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [viewProof, setViewProof] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [showSubManager, setShowSubManager] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: payments } = useQuery({
    queryKey: ["admin-payments", filter],
    queryFn: async () => {
      let q = supabase.from("payment_submissions").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data: paymentRows, error } = await q;
      if (error) throw error;
      const userIds = [...new Set((paymentRows || []).map((row: any) => row.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length ? await supabase.from("profiles").select("user_id, display_name, email").in("user_id", userIds) : { data: [] };
      const profilesByUserId = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
      return ((paymentRows as any[]) || []).map((payment: any) => ({
        ...payment,
        profile: profilesByUserId.get(payment.user_id) || null,
      }));
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data: subscriptionRows, error } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((subscriptionRows || []).map((row: any) => row.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length ? await supabase.from("profiles").select("user_id, display_name, email").in("user_id", userIds) : { data: [] };
      const profilesByUserId = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
      return ((subscriptionRows as any[]) || []).map((subscription: any) => ({
        ...subscription,
        profile: profilesByUserId.get(subscription.user_id) || null,
      }));
    },
  });

  const sendNotification = async (userId: string, title: string, message: string, type: string) => {
    if (!message.trim()) return;
    await supabase.from("notifications").insert({
      user_id: userId,
      target_user_id: userId,
      target: "user",
      title,
      message,
      type,
      created_by: user?.id,
    });
  };

  const approve = async (p: any, manualNote: string = "") => {
    const days = p.plan_type === "yearly" ? 365 : 30;

    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", p.user_id)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseDate = existingSub?.expires_at && new Date(existingSub.expires_at) > new Date() ? new Date(existingSub.expires_at) : new Date();
    const expires = new Date(baseDate);
    expires.setDate(expires.getDate() + days);

    if (existingSub) {
      await supabase.from("subscriptions").update({
        plan_type: p.plan_type,
        status: "active",
        starts_at: existingSub.starts_at || new Date().toISOString(),
        expires_at: expires.toISOString(),
      }).eq("id", existingSub.id);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: p.user_id,
        plan_type: p.plan_type,
        starts_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
        status: "active",
      });
    }

    await supabase.from("payment_submissions").update({
      status: "approved",
      admin_notes: manualNote || null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", p.id);

    if (p.referral_code) {
      const { data: aff } = await supabase.from("affiliates").select("id, user_id").eq("referral_code", p.referral_code).eq("is_active", true).maybeSingle();
      if (aff && aff.user_id !== p.user_id) {
        const { data: existingReferral } = await supabase.from("referrals").select("id").eq("referred_user_id", p.user_id).eq("affiliate_id", aff.id).maybeSingle();
        if (!existingReferral) {
          await supabase.from("referrals").insert({ affiliate_id: aff.id, referred_user_id: p.user_id });
        }

        const { data: existingEarning } = await supabase.from("affiliate_earnings").select("id").eq("payment_submission_id", p.id).maybeSingle();
        if (!existingEarning) {
          await supabase.from("affiliate_earnings").insert({
            affiliate_id: aff.id,
            payment_submission_id: p.id,
            amount: 100,
          });
        }
      }
    }

    // Build combined notification message
    const preset = (methods as any)?.approval_message || "Your payment has been approved!";
    const fullMessage = manualNote.trim() ? `${preset}\n\n${manualNote.trim()}` : preset;
    await sendNotification(p.user_id, "Payment Approved ✅", fullMessage, "success");

    toast.success("Payment approved & subscription activated!");
    setApproveId(null);
    setApproveNotes("");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
    qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  };

  const reject = async (id: string) => {
    const p = payments?.find((row: any) => row.id === id);
    await supabase.from("payment_submissions").update({
      status: "rejected",
      admin_notes: rejectNotes,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    if (p) {
      const preset = (methods as any)?.rejection_message || "Your payment was not approved.";
      const fullMessage = rejectNotes.trim() ? `${preset}\n\n${rejectNotes.trim()}` : preset;
      await sendNotification(p.user_id, "Payment Rejected ❌", fullMessage, "error");
    }

    setRejectId(null);
    setRejectNotes("");
    toast.success("Payment rejected");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  const cancelSubscription = async (subId: string) => {
    await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subId);
    toast.success("Subscription cancelled");
    qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  };

  const extendSubscription = async (subId: string, days: number) => {
    const sub = subscriptions?.find((s: any) => s.id === subId);
    if (!sub) return;
    const current = new Date(sub.expires_at);
    current.setDate(current.getDate() + days);
    await supabase.from("subscriptions").update({ expires_at: current.toISOString(), status: "active" }).eq("id", subId);
    toast.success(`Extended by ${days} days`);
    qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  };

  const filters = ["all", "pending", "approved", "rejected"] as const;
  const paymentStats = {
    pending: payments?.filter((payment: any) => payment.status === "pending").length || 0,
    approved: payments?.filter((payment: any) => payment.status === "approved").length || 0,
    rejected: payments?.filter((payment: any) => payment.status === "rejected").length || 0,
    subscriptions: subscriptions?.filter((subscription: any) => subscription.status === "active").length || 0,
  };

  const filteredSubscriptions = (subscriptions || []).filter((subscription: any) =>
    sameDay(subscription.expires_at, selectedDate) || sameDay(subscription.starts_at, selectedDate)
  );

  const filteredPaymentsByDate = (payments || []).filter((payment: any) => sameDay(payment.created_at, selectedDate));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><DollarSign size={20} /> Payment Submissions</h2>
        <button onClick={() => setShowSubManager(!showSubManager)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary/50 text-xs font-medium">
          <Calendar size={14} /> {showSubManager ? "Show Payments" : "Subscriptions"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: paymentStats.pending },
          { label: "Approved", value: paymentStats.approved },
          { label: "Rejected", value: paymentStats.rejected },
          { label: "Active Subs", value: paymentStats.subscriptions },
        ].map((item) => (
          <div key={item.label} className="glass rounded-xl border border-border/30 p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-display font-black">{item.value}</p>
          </div>
        ))}
      </div>

      {!showSubManager ? (
        <>
          <div className="flex gap-2">
            {filters.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>{f}</button>
            ))}
          </div>

          <div className="space-y-3">
            {payments?.map((p: any) => (
              <div key={p.id} className="glass rounded-xl p-4 border border-border/30">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{p.profile?.display_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{p.profile?.email || "No email"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : p.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{p.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div><span className="text-muted-foreground">Plan:</span> {p.plan_type}</div>
                  <div><span className="text-muted-foreground">Amount:</span> ₦{Number(p.amount).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Sender:</span> {p.sender_name || "—"}</div>
                  <div><span className="text-muted-foreground">Ref:</span> {p.transaction_ref || "—"}</div>
                  <div><span className="text-muted-foreground">Date:</span> {new Date(p.created_at).toLocaleDateString()}</div>
                  {p.referral_code && <div><span className="text-muted-foreground">Referral:</span> {p.referral_code}</div>}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {p.proof_image_url && (
                    <button onClick={() => setViewProof(p.proof_image_url)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary/50 text-xs">
                      <Eye size={12} /> View Proof
                    </button>
                  )}
                  {p.status === "pending" && (
                    <>
                      <button onClick={() => { setApproveId(p.id); setApproveNotes(""); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium">
                        <Check size={12} /> Approve
                      </button>
                      <button onClick={() => setRejectId(p.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium">
                        <X size={12} /> Reject
                      </button>
                    </>
                  )}
                </div>
                {p.tracking_answers && Object.keys(p.tracking_answers).length > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-secondary/30 text-xs space-y-1">
                    {Object.entries(p.tracking_answers).map(([q, a]) => (
                      <div key={q}><span className="text-muted-foreground">{q}:</span> {String(a)}</div>
                    ))}
                  </div>
                )}
                {p.admin_notes && <p className="text-xs text-muted-foreground mt-2">Note: {p.admin_notes}</p>}
              </div>
            ))}
            {(!payments || payments.length === 0) && (
              <p className="text-center text-muted-foreground text-sm py-8">No payments found</p>
            )}
          </div>

          <div className="glass rounded-2xl border border-border/30 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Payments Calendar</h3>
              <p className="text-xs text-muted-foreground">Pick a date to inspect submissions from that day.</p>
            </div>
            <DateCalendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-xl border border-border/20 bg-secondary/20 p-3" />
            <div className="space-y-2">
              {filteredPaymentsByDate.length > 0 ? filteredPaymentsByDate.map((payment: any) => (
                <div key={`calendar-${payment.id}`} className="rounded-xl bg-secondary/30 p-3 text-xs">
                  <p className="font-medium">{payment.profile?.display_name || payment.profile?.email || "User"}</p>
                  <p className="text-muted-foreground">{payment.plan_type} · ₦{Number(payment.amount).toLocaleString()} · {payment.status}</p>
                </div>
              )) : <p className="text-xs text-muted-foreground">No payment submissions for the selected day.</p>}
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="glass rounded-2xl border border-border/30 p-4 space-y-4 h-fit">
            <div>
              <h3 className="text-sm font-semibold">Subscriptions Calendar</h3>
              <p className="text-xs text-muted-foreground">See who starts or expires around any chosen date.</p>
            </div>
            <DateCalendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-xl border border-border/20 bg-secondary/20 p-3" />
            <div className="rounded-xl bg-secondary/30 p-3 text-xs">
              <p className="font-medium">Selected day summary</p>
              <p className="text-muted-foreground mt-1">{filteredSubscriptions.length} subscription event(s)</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Active & Past Subscriptions</h3>
            {filteredSubscriptions.map((s: any) => {
              const isExpired = new Date(s.expires_at) < new Date();
              const isCancelled = s.status === "cancelled";
              return (
                <div key={s.id} className={`glass rounded-xl p-4 border ${isCancelled || isExpired ? "border-border/30 opacity-60" : "border-green-500/30"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{s.profile?.display_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{s.profile?.email || "No email"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isCancelled ? "bg-red-500/20 text-red-400" : isExpired ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}>
                      {isCancelled ? "Cancelled" : isExpired ? "Expired" : "Active"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                    <div><span className="text-muted-foreground">Plan:</span> {s.plan_type}</div>
                    <div><span className="text-muted-foreground">Started:</span> {new Date(s.starts_at).toLocaleDateString()}</div>
                    <div><span className="text-muted-foreground">Expires:</span> {new Date(s.expires_at).toLocaleDateString()}</div>
                    <div><span className="text-muted-foreground">Status:</span> {s.status}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!isCancelled && (
                      <button onClick={() => cancelSubscription(s.id)} className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs">Cancel</button>
                    )}
                    <button onClick={() => extendSubscription(s.id, 30)} className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs">+30 Days</button>
                    <button onClick={() => extendSubscription(s.id, 365)} className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs">+1 Year</button>
                  </div>
                </div>
              );
            })}
            {filteredSubscriptions.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">No subscriptions on the selected date</p>
            )}
          </div>
        </div>
      )}

      {viewProof && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewProof(null)}>
          <img src={viewProof} alt="Payment proof" className="max-w-full max-h-[80vh] rounded-xl" />
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 border border-border/30 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Reject Payment</h3>
            {(methods as any)?.rejection_message && (
              <p className="text-xs text-muted-foreground mb-2 p-2 rounded-lg bg-secondary/30">Preset: {(methods as any).rejection_message}</p>
            )}
            <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Reason (optional)" className="w-full bg-secondary/50 border border-border/30 rounded-xl px-4 py-3 text-sm outline-none mb-3 min-h-[80px]" />
            <div className="flex gap-2">
              <button onClick={() => setRejectId(null)} className="flex-1 py-2 rounded-xl bg-secondary text-sm">Cancel</button>
              <button onClick={() => reject(rejectId)} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm">Reject</button>
            </div>
          </div>
        </div>
      )}

      {approveId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 border border-border/30 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Approve Payment</h3>
            {(methods as any)?.approval_message && (
              <p className="text-xs text-muted-foreground mb-2 p-2 rounded-lg bg-secondary/30">Preset: {(methods as any).approval_message}</p>
            )}
            <textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Optional personal message to user" className="w-full bg-secondary/50 border border-border/30 rounded-xl px-4 py-3 text-sm outline-none mb-3 min-h-[80px]" />
            <div className="flex gap-2">
              <button onClick={() => setApproveId(null)} className="flex-1 py-2 rounded-xl bg-secondary text-sm">Cancel</button>
              <button onClick={() => { const p = payments?.find((r: any) => r.id === approveId); if (p) approve(p, approveNotes); }} className="flex-1 py-2 rounded-xl bg-green-500 text-white text-sm">Approve & Notify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;
