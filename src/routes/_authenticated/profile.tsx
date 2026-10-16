import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Trash2,
  FileText,
  MapPin,
  Shield,
  Bell,
  Ban,
  VolumeX,
  Check,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { deleteMyAccount } from "@/lib/account.functions";
import { PageContainer } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Privacy Settings — HerWay" },
      { name: "description", content: "Manage display name, privacy preferences, blocked users, notifications, and saved places." },
      { property: "og:title", content: "Profile & Privacy Settings — HerWay" },
      { property: "og:description", content: "Your HerWay privacy preferences and settings." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { session, displayName, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);

  const [name, setName] = useState("");
  useEffect(() => setName(displayName ?? ""), [displayName]);

  // Privacy & Notifications state
  const [allowDMs, setAllowDMs] = useState(true);
  const [notifyReplies, setNotifyReplies] = useState(true);
  const [notifyStatus, setNotifyStatus] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch profile settings
  const { data: profileData } = useQuery({
    queryKey: ["profile_settings", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("allow_direct_messages, notify_on_replies, notify_on_status_change")
        .eq("id", session!.user.id)
        .maybeSingle();
      if (data) {
        setAllowDMs(data.allow_direct_messages ?? true);
        setNotifyReplies(data.notify_on_replies ?? true);
        setNotifyStatus(data.notify_on_status_change ?? true);
      }
      return data;
    },
  });

  // Fetch saved places
  const { data: places = [] } = useQuery({
    queryKey: ["saved_places"],
    queryFn: async () => (await supabase.from("saved_places").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  // Fetch blocked users
  const { data: blockedUsers = [] } = useQuery({
    queryKey: ["blocked_users", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: blocks } = await supabase
        .from("user_blocks")
        .select("id, blocked_id, created_at")
        .eq("user_id", session!.user.id);
      if (!blocks || blocks.length === 0) return [];

      const blockedIds = blocks.map((b) => b.blocked_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", blockedIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

      return blocks.map((b) => ({
        ...b,
        displayName: map.get(b.blocked_id) || "Blocked Member",
      }));
    },
  });

  // Fetch muted users
  const { data: mutedUsers = [] } = useQuery({
    queryKey: ["muted_users", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: mutes } = await supabase
        .from("user_mutes")
        .select("id, muted_id, created_at")
        .eq("user_id", session!.user.id);
      if (!mutes || mutes.length === 0) return [];

      const mutedIds = mutes.map((m) => m.muted_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", mutedIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

      return mutes.map((m) => ({
        ...m,
        displayName: map.get(m.muted_id) || "Muted Member",
      }));
    },
  });

  async function saveName() {
    if (!session) return;
    const n = name.trim();
    if (n.length < 2 || n.length > 40) {
      toast.error("Use 2–40 characters.");
      return;
    }
    const { error } = await supabase.from("profiles").update({ display_name: n }).eq("id", session.user.id);
    if (error) {
      toast.error("Could not save display name.");
      return;
    }
    await refreshProfile();
    toast.success("Display name updated.");
  }

  async function updatePreference(key: "allow_direct_messages" | "notify_on_replies" | "notify_on_status_change", val: boolean) {
    if (!session) return;
    setSavingSettings(true);
    if (key === "allow_direct_messages") setAllowDMs(val);
    if (key === "notify_on_replies") setNotifyReplies(val);
    if (key === "notify_on_status_change") setNotifyStatus(val);

    const { error } = await supabase.from("profiles").update({ [key]: val }).eq("id", session.user.id);
    if (error) {
      toast.error("Failed to update setting");
    } else {
      toast.success("Settings updated");
    }
    setSavingSettings(false);
  }

  async function unblockUser(blockId: string) {
    await supabase.from("user_blocks").delete().eq("id", blockId);
    toast.success("User unblocked");
    qc.invalidateQueries({ queryKey: ["blocked_users"] });
  }

  async function unmuteUser(muteId: string) {
    await supabase.from("user_mutes").delete().eq("id", muteId);
    toast.success("User unmuted");
    qc.invalidateQueries({ queryKey: ["muted_users"] });
  }

  async function removePlace(id: string) {
    await supabase.from("saved_places").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["saved_places"] });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { next: "/" }, replace: true });
  }

  async function deleteAccount() {
    if (!confirm("Delete your account permanently? Your reports, saved places, and profile will be erased. This cannot be undone.")) return;
    try {
      await del();
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Your account was deleted.");
      navigate({ to: "/", replace: true });
    } catch {
      toast.error("Couldn't delete your account. Please try again.");
    }
  }

  return (
    <PageContainer className="max-w-3xl pb-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Profile & Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in pseudonymously. Your email address is strictly private and never exposed to other members or public readers.
      </p>

      {/* Display Name Section */}
      <section className="mt-8 rounded-3xl border bg-card p-6 shadow-soft space-y-3">
        <Label htmlFor="dn" className="text-base font-semibold">Display Name</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The public pseudonym others see in community discussions and messages. Avoid your legal name or identifying numbers.
        </p>
        <div className="mt-2 flex gap-2">
          <Input id="dn" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          <Button onClick={saveName} className="rounded-xl px-5">Save</Button>
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/my-reports" className="flex items-center gap-3 rounded-3xl border bg-card p-5 hover:bg-muted shadow-soft transition">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <div>
            <span className="block font-semibold text-sm">My Reports</span>
            <span className="text-xs text-muted-foreground">Track submission status & appeals</span>
          </div>
        </Link>
        <Link to="/guidelines" className="flex items-center gap-3 rounded-3xl border bg-card p-5 hover:bg-muted shadow-soft transition">
          <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
            <Shield className="size-5" />
          </span>
          <div>
            <span className="block font-semibold text-sm">Community Guidelines</span>
            <span className="text-xs text-muted-foreground">Safety rules and principles</span>
          </div>
        </Link>
      </div>

      {/* Privacy Toggles Section */}
      <section className="mt-6 rounded-3xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-primary" />
          <h2 className="font-semibold text-base">Privacy Preferences</h2>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Allow direct messages</p>
              <p className="text-xs text-muted-foreground">Receive message requests from other members in the Messages tab.</p>
            </div>
            <Switch
              checked={allowDMs}
              onCheckedChange={(checked) => updatePreference("allow_direct_messages", checked)}
              disabled={savingSettings}
            />
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="mt-6 rounded-3xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-primary" />
          <h2 className="font-semibold text-base">Notifications</h2>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Post and reply alerts</p>
              <p className="text-xs text-muted-foreground">Notify in-app when someone responds to your community posts.</p>
            </div>
            <Switch
              checked={notifyReplies}
              onCheckedChange={(checked) => updatePreference("notify_on_replies", checked)}
              disabled={savingSettings}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Report status updates</p>
              <p className="text-xs text-muted-foreground">Receive alerts when a moderator reviews, clarifies, or publishes your incident.</p>
            </div>
            <Switch
              checked={notifyStatus}
              onCheckedChange={(checked) => updatePreference("notify_on_status_change", checked)}
              disabled={savingSettings}
            />
          </div>
        </div>
      </section>

      {/* Blocked & Muted Users Section */}
      <section className="mt-6 rounded-3xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <Ban className="size-4 text-destructive" />
          <h2 className="font-semibold text-base">Safety & Moderation Controls</h2>
        </div>

        {/* Blocked Users */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocked Users ({blockedUsers.length})</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Blocked members cannot message you or see your community posts.</p>
          {blockedUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2 py-2">No blocked users.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {blockedUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{u.displayName}</span>
                  <Button size="sm" variant="outline" onClick={() => unblockUser(u.id)} className="h-8 rounded-xl text-xs">
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Muted Users */}
        <div className="pt-3 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Muted Users ({mutedUsers.length})</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Muted members' posts and messages are hidden without notifying them.</p>
          {mutedUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2 py-2">No muted users.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {mutedUsers.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{m.displayName}</span>
                  <Button size="sm" variant="outline" onClick={() => unmuteUser(m.id)} className="h-8 rounded-xl text-xs">
                    Unmute
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Saved Places */}
      <section className="mt-6 rounded-3xl border bg-card p-6 shadow-soft space-y-3">
        <h2 className="font-semibold text-base">Saved Places ({places.length})</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Private to you. Save frequently visited bus stops, university gates, or intersections directly from the map.
        </p>
        {places.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No saved places yet.</p>}
        <ul className="mt-3 divide-y">
          {places.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {p.label}
              </span>
              <button
                aria-label={`Remove ${p.label}`}
                onClick={() => removePlace(p.id)}
                className="grid size-9 place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-destructive transition"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Your Data & Privacy Commitments */}
      <section className="mt-6 rounded-3xl border bg-card p-6 text-sm leading-relaxed text-muted-foreground space-y-2">
        <h2 className="font-semibold text-foreground">Data Privacy Commitments</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>We never collect, store, or sell real names, phone contacts, or GPS location history.</li>
          <li>Account deletion erases your profile, private reports, mutes, blocks, and saved places permanently.</li>
          <li>Published map pins are unlinked from your account and remain strictly as generalized safety data.</li>
        </ul>
      </section>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="outline" onClick={signOut} className="rounded-xl px-5">
          Sign out
        </Button>
        <Button variant="destructive" onClick={deleteAccount} className="rounded-xl px-5">
          Delete account permanently
        </Button>
      </div>
    </PageContainer>
  );
}
