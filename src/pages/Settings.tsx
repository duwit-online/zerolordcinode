import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, ChevronRight, Crown, Mail, Shield, SlidersHorizontal, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useSubscription";
import { useUnreadCount } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import JellyfinLinkPanel from "@/components/JellyfinLinkPanel";

const Settings = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, loading, refreshProfile } = useAuth();
  const { isPremium } = useIsPremium();
  const unreadCount = useUnreadCount();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
  }, [profile?.display_name, profile?.avatar_url]);

  const profileChanged = useMemo(
    () => displayName !== (profile?.display_name ?? "") || avatarUrl !== (profile?.avatar_url ?? ""),
    [avatarUrl, displayName, profile?.avatar_url, profile?.display_name],
  );

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be signed in.");

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        } as never)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast({ title: "Settings saved", description: "Your profile has been updated." });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not update your profile.", variant: "destructive" });
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 pb-24 pt-20 md:px-12 md:pb-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background px-4 pb-24 pt-20 md:px-12 md:pb-8">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Your account settings are only available to signed-in users.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/auth")}>Go to sign in</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-20 md:px-12 md:pb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            User settings
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Account settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and account shortcuts.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update the name and avatar shown across your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your display name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email ?? ""} readOnly />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar-url">Avatar URL</Label>
              <Input id="avatar-url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => updateProfile.mutate()} disabled={!profileChanged || updateProfile.isPending}>
                {updateProfile.isPending ? "Saving..." : "Save profile"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/profile")}>Back to profile</Button>
            </div>
          </CardContent>
        </Card>

        <JellyfinLinkPanel />




        <Card>
          <CardHeader>
            <CardTitle>Account overview</CardTitle>
            <CardDescription>Quick access to the most important parts of your account.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <button onClick={() => navigate("/premium")} className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-4 text-left transition-colors hover:bg-accent">
              <div className="flex items-center gap-3">
                <Crown className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Plan</p>
                  <p className="text-xs text-muted-foreground">{isPremium ? "Premium access is active" : "You are currently on the free plan"}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button onClick={() => navigate("/profile")} className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-4 text-left transition-colors hover:bg-accent">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Profile hub</p>
                  <p className="text-xs text-muted-foreground">Return to your main profile page.</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="rounded-lg border border-border bg-background/60 p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Notifications</p>
                  <p className="text-xs text-muted-foreground">You have {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}.</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/60 p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Signed in as</p>
                  <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-4 text-left transition-colors hover:bg-accent md:col-span-2">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Admin dashboard</p>
                    <p className="text-xs text-muted-foreground">Open the management area for platform controls.</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Settings;