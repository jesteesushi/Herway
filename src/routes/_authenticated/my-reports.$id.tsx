import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Scale, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/AppShell";
import { CategoryBadge, ReportTypeBadge } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABEL, formatWindow, type ReportStatus } from "@/lib/herway";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-reports/$id")({
  head: () => ({ meta: [{ title: "Report status — HerWay" }, { name: "description", content: "Private status of your HerWay report." }, { property: "og:title", content: "Report status — HerWay" }, { property: "og:description", content: "Private report status." }] }),
  component: Status,
});

const EXPLAIN: Record<ReportStatus, string> = {
  awaiting_review: "A moderator will review your report. Nothing is public yet.",
  needs_clarification: "A moderator has a question for you below. Answer only what you're comfortable with.",
  published: "A privacy-safe version of your report now appears on the map. Your identity is never shown.",
  not_published: "This report won't appear on the map, usually to protect someone's privacy. You can submit an appeal below to request reconsideration.",
  removed: "This report was taken off the map. You can submit an appeal below to request reconsideration.",
};

function Status() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reply, setReply] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ["my-report", id],
    queryFn: async () => (await supabase.from("incident_reports").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: msgs = [] } = useQuery({
    queryKey: ["clar", id],
    queryFn: async () => (await supabase.from("clarification_messages").select("*").eq("report_id", id).order("created_at")).data ?? [],
  });

  const { data: appeal } = useQuery({
    queryKey: ["report-appeal", id],
    queryFn: async () => (await supabase.from("incident_appeals").select("*").eq("report_id", id).maybeSingle()).data,
  });

  if (isLoading) return <PageContainer>Loading…</PageContainer>;
  if (!report) return <PageContainer><p>Report not found.</p><Link to="/my-reports" className="text-primary underline">Back to my reports</Link></PageContainer>;

  async function send() {
    if (!session || !reply.trim()) return;
    const { error } = await supabase.from("clarification_messages").insert({ report_id: id, author_id: session.user.id, body: reply.trim() });
    if (error) { toast.error("Couldn't send."); return; }
    setReply("");
    qc.invalidateQueries({ queryKey: ["clar", id] });
    toast.success("Sent privately to moderators.");
  }

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (!session || appealReason.trim().length < 10) {
      toast.error("Please provide at least 10 characters explaining why this report should be published.");
      return;
    }
    setSubmittingAppeal(true);
    const { error } = await supabase.from("incident_appeals").insert({
      report_id: id,
      reporter_id: session.user.id,
      reason: appealReason.trim(),
      status: "pending",
    });
    setSubmittingAppeal(false);
    if (error) {
      toast.error("Could not submit appeal: " + error.message);
    } else {
      toast.success("Appeal submitted for moderator review.");
      setAppealReason("");
      qc.invalidateQueries({ queryKey: ["report-appeal", id] });
    }
  }

  async function withdraw() {
    if (!confirm("Withdraw and delete this report? This can't be undone.")) return;
    const { error } = await supabase.from("incident_reports").delete().eq("id", id);
    if (error) { toast.error("Couldn't withdraw."); return; }
    toast.success("Your report was deleted.");
    navigate({ to: "/my-reports" });
  }

  const canReply = report.status !== "published" && report.status !== "awaiting_review" || msgs.length > 0;
  const canAppeal = (report.status === "not_published" || report.status === "removed");

  return (
    <PageContainer className="max-w-3xl pb-16">
      <Link to="/my-reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> My reports</Link>
      <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Reference {report.ref_code}</p>
      <h1 className="text-3xl font-semibold">{STATUS_LABEL[report.status]}</h1>
      <p className="mt-2 text-muted-foreground">{EXPLAIN[report.status]}</p>

      <div className="mt-6 rounded-3xl border bg-card p-6 shadow-soft space-y-3">
        <div className="flex flex-wrap gap-2"><CategoryBadge category={report.category} /><ReportTypeBadge type={report.report_type} /></div>
        <p className="text-sm text-muted-foreground">{report.place_label ?? "Location chosen on map"} · {formatWindow(report.date_from, report.date_to)}</p>
        {report.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{report.description}</p>}
        <p className="pt-2 text-xs text-muted-foreground border-t">Only you and HerWay moderators can access this report page.</p>
      </div>

      {/* Formal Appeal Section */}
      {canAppeal && (
        <section className="mt-6 rounded-3xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Appeal Decision</h2>
          </div>

          {appeal ? (
            <div className="rounded-2xl bg-muted/60 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  {appeal.status === "pending" && <Clock className="size-4 text-amber-600" />}
                  {appeal.status === "approved" && <CheckCircle2 className="size-4 text-emerald-600" />}
                  {appeal.status === "rejected" && <XCircle className="size-4 text-destructive" />}
                  Appeal Status: <span className="capitalize">{appeal.status}</span>
                </span>
                <span className="text-xs text-muted-foreground">{new Date(appeal.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Your request: </span>{appeal.reason}</p>
              {appeal.moderator_notes && (
                <p className="text-xs bg-card p-2 rounded-xl border mt-2">
                  <span className="font-semibold">Moderator Note: </span>{appeal.moderator_notes}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={submitAppeal} className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you believe this incident should be published (e.g. details were clarified, personal info removed, or community safety justifies it), explain your reason below:
              </p>
              <Textarea
                rows={3}
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Explain why this decision should be reconsidered…"
                className="rounded-xl text-sm"
              />
              <Button type="submit" disabled={submittingAppeal || appealReason.trim().length < 10} className="rounded-xl">
                {submittingAppeal ? "Submitting…" : "Submit Appeal"}
              </Button>
            </form>
          )}
        </section>
      )}

      {/* Messages with Moderators */}
      {(msgs.length > 0 || canReply) && (
        <div className="mt-6 rounded-3xl border bg-card p-6 shadow-soft space-y-4">
          <h2 className="text-lg font-semibold">Clarification with Moderators</h2>
          <div className="space-y-2">
            {msgs.map((m) => (
              <div key={m.id} className={cn("max-w-[85%] rounded-2xl p-3 text-sm", m.from_moderator ? "bg-secondary" : "ml-auto bg-primary text-primary-foreground")}>
                <p className="text-xs opacity-70 mb-0.5">{m.from_moderator ? "Moderator" : "You"}</p>
                {m.body}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Textarea rows={2} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a private reply" className="rounded-xl" />
            <Button onClick={send} disabled={!reply.trim()} className="rounded-xl">Send</Button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <Button variant="outline" onClick={withdraw} className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10">
          Withdraw report
        </Button>
      </div>
    </PageContainer>
  );
}
