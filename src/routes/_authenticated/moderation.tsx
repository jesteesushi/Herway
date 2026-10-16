import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/AppShell";
import { LocationPicker } from "@/components/ClientMap";
import { CategoryBadge, ReportTypeBadge } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_LABEL, distanceKm, formatWindow, generaliseLocation, looksIdentifying, type IncidentReport } from "@/lib/herway";
import { approveReportFn, bootstrapFirstModeratorFn } from "@/lib/moderation.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/moderation")({
  head: () => ({ meta: [{ title: "Moderation — HerWay" }, { name: "description", content: "Moderator review queue." }, { property: "og:title", content: "Moderation — HerWay" }, { property: "og:description", content: "Moderator review queue." }, { name: "robots", content: "noindex" }] }),
  component: Moderation,
});

function Moderation() {
  const { isModerator, ready, refreshProfile } = useAuth();
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    if (!ready || isModerator) {
      setCheckingBootstrap(false);
      return;
    }
    supabase.rpc("can_bootstrap_moderator").then(({ data }) => {
      setCanBootstrap(!!data);
      setCheckingBootstrap(false);
    }).catch(() => {
      setCheckingBootstrap(false);
    });
  }, [ready, isModerator]);

  if (!ready || checkingBootstrap) return <PageContainer>Loading…</PageContainer>;
  if (!isModerator) {
    if (canBootstrap) {
      return (
        <PageContainer className="max-w-md">
          <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                First-Time Setup
              </span>
              <h1 className="text-xl font-semibold">Claim Initial Moderator Role</h1>
              <p className="text-xs leading-relaxed text-muted-foreground">
                No moderators exist in the system yet. Enter the bootstrap token to initialize the first administrator account.
                This portal is permanently disabled once the first moderator is created.
              </p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!bootstrapSecret.trim()) {
                  toast.error("Enter the bootstrap token.");
                  return;
                }
                setBootstrapping(true);
                try {
                  const res = await bootstrapFirstModeratorFn({
                    data: { secretToken: bootstrapSecret.trim() },
                  });
                  toast.success(res.message || "Moderator role granted!");
                  await refreshProfile();
                } catch (err: any) {
                  const { error } = await supabase.rpc("claim_first_moderator", {
                    _secret_token: bootstrapSecret.trim(),
                  });
                  if (error) {
                    toast.error(err?.message || error.message || "Failed to claim moderator role.");
                  } else {
                    toast.success("Moderator role granted!");
                    await refreshProfile();
                  }
                } finally {
                  setBootstrapping(false);
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="bs-token">Bootstrap Security Token</Label>
                <Input
                  id="bs-token"
                  type="password"
                  placeholder="Configured MODERATOR_BOOTSTRAP_TOKEN"
                  value={bootstrapSecret}
                  onChange={(e) => setBootstrapSecret(e.target.value)}
                  disabled={bootstrapping}
                />
              </div>
              <Button type="submit" className="w-full" disabled={bootstrapping}>
                {bootstrapping ? "Claiming…" : "Claim Moderator Role"}
              </Button>
            </form>
            <div className="pt-2 text-center">
              <Link to="/" className="text-xs text-muted-foreground underline hover:text-foreground">
                Back to Explore
              </Link>
            </div>
          </div>
        </PageContainer>
      );
    }
    return (
      <PageContainer>
        <h1 className="text-2xl font-semibold">Moderators only</h1>
        <p className="mt-2 text-muted-foreground">This area is restricted.</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back to Explore</Link>
      </PageContainer>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: reports = [] } = useQuery({
    queryKey: ["mod-reports"],
    queryFn: async () => (await supabase.from("incident_reports").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: flags = [] } = useQuery({
    queryKey: ["mod-flags"],
    queryFn: async () => (await supabase.from("incident_flags").select("*, published_incidents(area_label, category)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["mod-audit"],
    queryFn: async () => (await supabase.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: appeals = [] } = useQuery({
    queryKey: ["mod-appeals"],
    queryFn: async () =>
      (await supabase.from("incident_appeals").select("*, incident_reports(id, ref_code, category, place_label, description, status)").order("created_at", { ascending: false })).data ?? [],
  });
  const queue = reports.filter((r) => r.status === "awaiting_review" || r.status === "needs_clarification");
  const pendingAppeals = appeals.filter((a) => a.status === "pending");
  const current = reports.find((r) => r.id === selected) ?? null;

  return (
    <PageContainer className="max-w-6xl">
      <h1 className="text-3xl font-semibold">Moderation</h1>
      <Tabs defaultValue="queue" className="mt-4">
        <TabsList>
          <TabsTrigger value="queue">Queue ({queue.length})</TabsTrigger>
          <TabsTrigger value="all">All reports</TabsTrigger>
          <TabsTrigger value="flags">Flags ({flags.filter((f) => f.status === "open").length})</TabsTrigger>
          <TabsTrigger value="appeals">Appeals ({pendingAppeals.length})</TabsTrigger>
          <TabsTrigger value="community">Community reports</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        {(["queue", "all"] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <ul className="space-y-2">
                {(tab === "queue" ? queue : reports).map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setSelected(r.id)} className={cn("w-full rounded-2xl border bg-card p-3 text-left", selected === r.id && "border-primary bg-secondary")}>
                      <div className="flex items-center justify-between gap-2"><CategoryBadge category={r.category} /><span className="text-xs">{STATUS_LABEL[r.status]}</span></div>
                      <p className="mt-2 text-xs text-muted-foreground">{r.ref_code} · {new Date(r.created_at).toLocaleDateString("en-GB")}</p>
                    </button>
                  </li>
                ))}
                {(tab === "queue" ? queue : reports).length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
              </ul>
              {current ? <Review key={current.id} report={current} all={reports} /> : <p className="text-sm text-muted-foreground">Select a report to review.</p>}
            </div>
          </TabsContent>
        ))}
        <TabsContent value="flags">
          <FlagList flags={flags} />
        </TabsContent>
        <TabsContent value="appeals">
          <AppealsList appeals={appeals} />
        </TabsContent>
        <TabsContent value="community">
          <CommunityFlags />
        </TabsContent>
        <TabsContent value="audit">
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {audit.map((a) => (
              <li key={a.id} className="p-3"><span className="font-semibold">{a.action}</span> · {new Date(a.created_at).toLocaleString("en-GB")}<p className="text-muted-foreground">{a.reason}</p></li>
            ))}
            {audit.length === 0 && <li className="p-3 text-muted-foreground">No actions yet.</li>}
          </ul>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function Review({ report, all }: { report: IncidentReport; all: IncidentReport[] }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [proposed] = useState(() => generaliseLocation(report.lat, report.lng));
  const [area, setArea] = useState(report.place_label ? `Near ${report.place_label.split(",")[0]}` : "");
  const [summary, setSummary] = useState(report.description?.slice(0, 280) ?? "");
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: msgs = [] } = useQuery({
    queryKey: ["clar", report.id],
    queryFn: async () => (await supabase.from("clarification_messages").select("*").eq("report_id", report.id).order("created_at")).data ?? [],
  });

  const duplicates = useMemo(
    () =>
      all.filter(
        (o) =>
          o.id !== report.id &&
          o.category === report.category &&
          distanceKm(o.lat, o.lng, report.lat, report.lng) < 1 &&
          Math.abs(new Date(o.date_from).getTime() - new Date(report.date_from).getTime()) < 14 * 86400000,
      ),
    [all, report],
  );

  const refresh = () => ["mod-reports", "mod-audit", "clar", "published_incidents"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  async function log(action: string, why: string, publishedId?: string | null) {
    await supabase.from("moderation_actions").insert({ report_id: report.id, published_id: publishedId ?? null, moderator_id: session!.user.id, action, reason: why });
  }

  async function approve() {
    if (reason.trim().length < 3) { toast.error("Record a reason for the decision."); return; }
    if (area.trim().length < 3) { toast.error("Add a general area name."); return; }
    if (looksIdentifying(summary)) { toast.error("The public summary still looks like it contains contact details."); return; }
    setBusy(true);
    try {
      // Single server-side step: validates moderator permissions,
      // generates rounded coordinates server-side from private coordinates,
      // creates/updates published_incidents, updates incident_reports, and appends audit log atomically.
      await approveReportFn({
        data: {
          reportId: report.id,
          areaLabel: area.trim(),
          summary: summary.trim(),
          reason: reason.trim(),
        },
      });
      refresh();
      toast.success("Published to the map.");
    } catch (err: any) {
      // Direct RPC fallback if server function context is in client preview mode
      const { error } = await supabase.rpc("approve_and_publish_report", {
        _report_id: report.id,
        _area_label: area.trim(),
        _summary: summary.trim() || null,
        _reason: reason.trim(),
      });
      if (error) {
        toast.error(err?.message || error.message || "Couldn't publish.");
      } else {
        refresh();
        toast.success("Published to the map.");
      }
    } finally {
      setBusy(false);
    }
  }
  async function decline() {
    if (reason.trim().length < 3) { toast.error("Record a reason for the decision."); return; }
    setBusy(true);
    await supabase.from("incident_reports").update({ status: "not_published" }).eq("id", report.id);
    await log("not_published", reason.trim());
    setBusy(false); refresh(); toast.success("Marked as not published.");
  }
  async function removePublished() {
    if (reason.trim().length < 3) { toast.error("Record a reason for removal."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("remove_published_report", {
        _report_id: report.id,
        _reason: reason.trim(),
      });
      if (error) throw error;
      refresh();
      toast.success("Removed from the map.");
    } catch (err: any) {
      const pid = report.published_id;
      if (pid) {
        await supabase.from("incident_reports").update({ status: "removed", published_id: null }).eq("id", report.id);
        await supabase.from("published_incidents").delete().eq("id", pid);
        await log("removed", reason.trim(), pid);
        refresh();
        toast.success("Removed from the map.");
      } else {
        toast.error(err?.message || "Could not remove report.");
      }
    } finally {
      setBusy(false);
    }
  }
  async function ask() {
    if (!question.trim()) return;
    setBusy(true);
    await supabase.from("clarification_messages").insert({ report_id: report.id, author_id: session!.user.id, from_moderator: true, body: question.trim() });
    await supabase.from("incident_reports").update({ status: "needs_clarification" }).eq("id", report.id);
    await log("clarification_requested", question.trim().slice(0, 1000));
    setQuestion(""); setBusy(false); refresh(); toast.success("Question sent privately.");
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={report.category} /><ReportTypeBadge type={report.report_type} />
        <span className="text-sm text-muted-foreground">{report.ref_code} · {STATUS_LABEL[report.status]}</span>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Date window</dt><dd>{formatWindow(report.date_from, report.date_to)}</dd></div>
        <div><dt className="text-muted-foreground">Time of day (private)</dt><dd>{report.time_range ?? "Not given"}</dd></div>
        <div><dt className="text-muted-foreground">Place (private)</dt><dd>{report.place_label ?? "Map point only"}</dd></div>
        {report.report_type === "disclosed" && <div><dt className="text-muted-foreground">Consent to share</dt><dd>{report.consent_context ?? "Not given"}</dd></div>}
      </dl>
      {report.description && <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">{report.description}</p>}
      {report.context_details && <p className="text-sm"><span className="text-muted-foreground">Context: </span>{report.context_details}</p>}
      {looksIdentifying(`${report.description ?? ""} ${report.context_details ?? ""}`) && <p className="rounded-xl bg-warning/15 p-3 text-sm">Text may contain contact details. Remove them from the public summary.</p>}

      <div>
        <p className="text-sm font-semibold">Location: <span className="font-normal text-muted-foreground">dark pin is the private point, orange pin is the proposed public point</span></p>
        <div className="relative mt-2 h-64 overflow-hidden rounded-xl border"><LocationPicker value={{ lat: report.lat, lng: report.lng }} secondary={proposed} center={{ lat: report.lat, lng: report.lng }} /></div>
      </div>

      {duplicates.length > 0 && (
        <p className="rounded-xl bg-secondary p-3 text-sm">Possible duplicates (same category, within 1 km and 2 weeks): {duplicates.map((d) => d.ref_code).join(", ")}</p>
      )}

      {msgs.length > 0 && (
        <div className="space-y-1 text-sm">
          {msgs.map((m) => <p key={m.id}><span className="font-semibold">{m.from_moderator ? "Moderator" : "Reporter"}:</span> {m.body}</p>)}
        </div>
      )}

      {report.status !== "published" && report.status !== "removed" && (
        <>
          <div className="space-y-1.5"><Label htmlFor="ar">Public area name</Label><Input id="ar" value={area} maxLength={120} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Near Mirpur 10, Dhaka" /></div>
          <div className="space-y-1.5"><Label htmlFor="sm">Public summary (remove anything identifying)</Label><Textarea id="sm" rows={3} maxLength={400} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
          <div className="flex gap-2"><Input value={question} maxLength={1000} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask the reporter a private question" /><Button variant="outline" onClick={ask} disabled={busy}>Ask</Button></div>
        </>
      )}
      <div className="space-y-1.5"><Label htmlFor="rs">Internal reason (never shown publicly)</Label><Input id="rs" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} /></div>
      <div className="flex flex-wrap gap-2">
        {report.status === "published" ? (
          <Button variant="destructive" onClick={removePublished} disabled={busy}>Remove from map</Button>
        ) : report.status !== "removed" ? (
          <>
            <Button onClick={approve} disabled={busy}>Approve & publish</Button>
            <Button variant="outline" onClick={decline} disabled={busy}>Don't publish</Button>
          </>
        ) : (
          <Button onClick={approve} disabled={busy}>Reconsider & republish</Button>
        )}
      </div>
    </div>
  );
}

type Flag = { id: string; reason: string; details: string | null; status: string; created_at: string; published_id: string; published_incidents: { area_label: string; category: string } | null };
function FlagList({ flags }: { flags: Flag[] }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  async function resolve(f: Flag, remove: boolean) {
    if (remove) {
      await supabase.from("published_incidents").delete().eq("id", f.published_id);
      await supabase.from("moderation_actions").insert({ published_id: f.published_id, moderator_id: session!.user.id, action: "removed_after_flag", reason: `Flag: ${f.reason}` });
    } else {
      await supabase.from("incident_flags").update({ status: "resolved" }).eq("id", f.id);
      await supabase.from("moderation_actions").insert({ published_id: f.published_id, moderator_id: session!.user.id, action: "flag_resolved", reason: `Kept after flag: ${f.reason}` });
    }
    ["mod-flags", "mod-audit", "published_incidents"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }
  return (
    <ul className="space-y-2">
      {flags.map((f) => (
        <li key={f.id} className="rounded-2xl border bg-card p-4 text-sm">
          <p className="font-semibold">{f.published_incidents?.area_label ?? "Removed entry"} · {f.reason.replace("_", " ")}</p>
          {f.details && <p className="mt-1 text-muted-foreground">{f.details}</p>}
          {f.status === "open" ? (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => resolve(f, false)}>Keep entry</Button>
              <Button size="sm" variant="destructive" onClick={() => resolve(f, true)}>Remove entry</Button>
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">Resolved</p>}
        </li>
      ))}
      {flags.length === 0 && <p className="text-sm text-muted-foreground">No flags.</p>}
    </ul>
  );
}

function CommunityFlags() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { data: flags = [] } = useQuery({
    queryKey: ["mod-content-flags"],
    queryFn: async () =>
      (await supabase.from("content_flags").select("*, room_posts(id, title, body, removed_at), post_replies(id, body, removed_at)").order("created_at", { ascending: false })).data ?? [],
  });
  async function resolve(f: (typeof flags)[number], remove: boolean) {
    const me = session!.user.id;
    if (remove) {
      const now = new Date().toISOString();
      if (f.reply_id) await supabase.from("post_replies").update({ removed_at: now, removed_by: me }).eq("id", f.reply_id);
      else if (f.post_id) await supabase.from("room_posts").update({ removed_at: now, removed_by: me }).eq("id", f.post_id);
    }
    await supabase.from("content_flags").update({ status: remove ? "removed" : "resolved" }).eq("id", f.id);
    await supabase.from("moderation_actions").insert({ moderator_id: me, action: remove ? "community_content_removed" : "community_flag_kept", reason: `Flag: ${f.reason}` });
    ["mod-content-flags", "mod-audit"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }
  return (
    <ul className="space-y-2">
      {flags.map((f) => {
        const text = f.reply_id ? f.post_replies?.body : `${f.room_posts?.title ?? ""} — ${f.room_posts?.body ?? ""}`;
        return (
          <li key={f.id} className="rounded-2xl border bg-card p-4 text-sm">
            <p className="font-semibold">{f.reply_id ? "Reply" : "Post"} · {f.reason.replace("_", " ")}</p>
            <p className="mt-1 line-clamp-3 rounded-xl bg-muted p-2">{text ?? "Content deleted"}</p>
            {f.details && <p className="mt-1 text-muted-foreground">Reporter note: {f.details}</p>}
            {f.status === "open" ? (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resolve(f, false)}>Keep</Button>
                <Button size="sm" variant="destructive" onClick={() => resolve(f, true)}>Remove content</Button>
              </div>
            ) : <p className="mt-2 text-xs text-muted-foreground">{f.status === "removed" ? "Removed" : "Kept"}</p>}
          </li>
        );
      })}
      {flags.length === 0 && <p className="text-sm text-muted-foreground">No community reports.</p>}
    </ul>
  );
}

type AppealItem = {
  id: string;
  report_id: string;
  reporter_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  moderator_notes: string | null;
  created_at: string;
  incident_reports: {
    id: string;
    ref_code: string;
    category: string;
    place_label: string | null;
    description: string | null;
    status: string;
  } | null;
};

function AppealsList({ appeals }: { appeals: any[] }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function resolveAppeal(appeal: AppealItem, approve: boolean) {
    const note = (decisionNotes[appeal.id] ?? "").trim();
    if (note.length < 3) {
      toast.error("Please add a short note explaining the appeal decision.");
      return;
    }
    setBusyId(appeal.id);
    const me = session!.user.id;
    const now = new Date().toISOString();

    // 1. Update appeal record
    await supabase.from("incident_appeals").update({
      status: approve ? "approved" : "rejected",
      moderator_id: me,
      moderator_notes: note,
      resolved_at: now,
    }).eq("id", appeal.id);

    // 2. If approved, return the report to awaiting_review so moderators can re-publish or review it
    if (approve) {
      await supabase.from("incident_reports").update({
        status: "awaiting_review",
        updated_at: now,
      }).eq("id", appeal.report_id);
    }

    // 3. Log to audit trail
    await supabase.from("moderation_actions").insert({
      report_id: appeal.report_id,
      moderator_id: me,
      action: approve ? "appeal_approved" : "appeal_rejected",
      reason: `Appeal ${approve ? "approved" : "rejected"}: ${note}`,
    });

    setBusyId(null);
    ["mod-appeals", "mod-reports", "mod-audit"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    toast.success(approve ? "Appeal approved. Report moved to review queue." : "Appeal rejected.");
  }

  return (
    <ul className="space-y-3">
      {appeals.map((a: AppealItem) => (
        <li key={a.id} className="rounded-2xl border bg-card p-5 text-sm space-y-3 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-base">
              {a.incident_reports?.ref_code ?? "Report"} · {a.incident_reports?.category?.replace("_", " ")}
            </span>
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
              a.status === "pending" && "bg-amber-500/10 text-amber-700",
              a.status === "approved" && "bg-emerald-500/10 text-emerald-700",
              a.status === "rejected" && "bg-destructive/10 text-destructive"
            )}>
              {a.status}
            </span>
          </div>

          <div className="rounded-xl bg-muted p-3 space-y-1">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Reporter's Appeal Explanation</p>
            <p className="text-sm">{a.reason}</p>
          </div>

          {a.incident_reports?.description && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Original description: </span>
              {a.incident_reports.description}
            </div>
          )}

          {a.status === "pending" ? (
            <div className="space-y-2 pt-2 border-t">
              <Input
                placeholder="Moderator decision note (required)…"
                value={decisionNotes[a.id] ?? ""}
                onChange={(e) => setDecisionNotes((p) => ({ ...p, [a.id]: e.target.value }))}
                className="rounded-xl text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => resolveAppeal(a, true)}
                  disabled={busyId === a.id}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  Approve & Reopen for Review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveAppeal(a, false)}
                  disabled={busyId === a.id}
                  className="rounded-xl text-destructive hover:bg-destructive/10"
                >
                  Decline Appeal
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Resolution Note: </span>
              {a.moderator_notes ?? "No note provided"}
            </div>
          )}
        </li>
      ))}
      {appeals.length === 0 && <p className="text-sm text-muted-foreground">No appeals submitted.</p>}
    </ul>
  );
}
