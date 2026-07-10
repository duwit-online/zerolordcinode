import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Server, Link2, Unlink, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  getJellyfinLinkStatus,
  linkJellyfinAccount,
  unlinkJellyfinAccount,
  getJellyfinServerStatus,
} from "@/lib/tmdb";

export default function JellyfinLinkPanel() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { data: status } = useQuery({ queryKey: ["jf-link"], queryFn: getJellyfinLinkStatus });
  const { data: server } = useQuery({ queryKey: ["jf-server"], queryFn: getJellyfinServerStatus });

  const link = useMutation({
    mutationFn: () => linkJellyfinAccount(username, password),
    onSuccess: () => {
      toast({ title: "Jellyfin linked", description: "You can now stream with your account." });
      setPassword("");
      qc.invalidateQueries({ queryKey: ["jf-link"] });
    },
    onError: (e: any) => toast({ title: "Link failed", description: e.message, variant: "destructive" }),
  });

  const unlink = useMutation({
    mutationFn: unlinkJellyfinAccount,
    onSuccess: () => {
      toast({ title: "Unlinked" });
      qc.invalidateQueries({ queryKey: ["jf-link"] });
    },
  });

  useEffect(() => {
    if (status?.username) setUsername(status.username);
  }, [status?.username]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server size={18} className="text-primary" /> Jellyfin Account
        </CardTitle>
        <CardDescription>
          {server?.ok
            ? `Connected to ${server.serverName || "Jellyfin"}${server.version ? ` · ${server.version}` : ""}`
            : "Checking server..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.linked ? (
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/40 p-3">
            <div>
              <p className="text-sm font-semibold">Linked as {status.username}</p>
              <p className="text-xs text-muted-foreground">Streams and resume state use your Jellyfin account.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
              {unlink.isPending ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
              <span className="ml-1.5">Unlink</span>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="jf-user">Jellyfin username</Label>
              <Input id="jf-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <Label htmlFor="jf-pass">Password</Label>
              <Input id="jf-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="sm:col-span-2">
              <Button
                onClick={() => link.mutate()}
                disabled={!username || !password || link.isPending}
                className="w-full sm:w-auto"
              >
                {link.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Link2 size={14} className="mr-2" />}
                Link Jellyfin Account
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Credentials are sent over TLS to the backend and never stored in the browser. The Jellyfin server URL and API key are held only by the backend.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
