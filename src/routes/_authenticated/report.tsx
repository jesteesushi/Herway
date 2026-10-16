import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/AppShell";
import { LocationPicker } from "@/components/ClientMap";
import { CategoryIcon } from "@/components/CategoryBadge";
import { PlaceSearch } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, REPORT_TYPES, categoryLabel, looksIdentifying, reportTypeLabel, type Category, type ReportType } from "@/lib/herway";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Report an incident — HerWay" },
      { name: "description", content: "Share a safety incident privately. Moderators review every report before anything appears on the map." },
      { property: "og:title", content: "Report an incident — HerWay" },
      { property: "og:description", content: "Share a safety incident privately and safely." },
    ],
  }),
  component: ReportFlow,
});

type Draft = {
  reportType: ReportType | null;
  consent: "consented" | "not_sure" | "not_asked" | null;
  category: Category | null;
  dateFrom: string;
  dateTo: string;
  timeRange: string;
  description: string;
  context: string;
  point: { lat: number; lng: number } | null;
  placeLabel: string;
};
const EMPTY: Draft = { reportType: null, consent: null, category: null, dateFrom: "", dateTo: "", timeRange: "", description: "", context: "", point: null, placeLabel: "" };
const KEY = "herway-report-draft";
const STEPS = ["How you know", "What happened", "Where", "Privacy & review"];
const today = () => new Date().toISOString().slice(0, 10);

function ReportFlow() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; ref: string } | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY);
    if (saved) try { setD({ ...EMPTY, ...JSON.parse(saved) }); } catch { /* ignore */ }
  }, []);
  useEffect(() => { sessionStorage.setItem(KEY, JSON.stringify(d)); }, [d]);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const canNext = [
    !!d.reportType && (d.reportType !== "disclosed" || !!d.consent),
    !!d.category && !!d.dateFrom && d.dateFrom <= today() && (!d.dateTo || d.dateTo >= d.dateFrom),
    !!d.point,
    true,
  ][step];
  const identifying = looksIdentifying(`${d.description} ${d.context}`);

  async function submit() {
    if (!session || !d.reportType || !d.category || !d.point) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("incident_reports")
      .insert({
        reporter_id: session.user.id,
        report_type: d.reportType,
        category: d.category,
        date_from: d.dateFrom,
        date_to: d.dateTo || d.dateFrom,
        time_range: d.timeRange.trim() || null,
        description: d.description.trim() || null,
        context_details: d.context.trim() || null,
        consent_context: d.reportType === "disclosed" ? d.consent : null,
        lat: d.point.lat,
        lng: d.point.lng,
        place_label: d.placeLabel.trim() || null,
      })
      .select("id, ref_code")
      .single();
    setBusy(false);
    if (error) { toast.error(error.message.includes("5 reports") ? error.message : "Your report couldn't be sent. Please try again."); return; }
    sessionStorage.removeItem(KEY);
    setDone({ id: data.id, ref: data.ref_code });
  }

  if (done) {
    return (
      <PageContainer className="max-w-xl text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h1 className="mt-4 text-3xl font-semibold">Thank you for sharing</h1>
        <p className="mt-2 text-muted-foreground">Your report is private and waiting for a moderator. It will not appear on the map unless it is approved.</p>
        <div className="mx-auto mt-6 w-fit rounded-2xl border bg-card px-6 py-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Reference</p>
          <p className="font-display text-2xl font-semibold">{done.ref}</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate({ to: "/my-reports/$id", params: { id: done.id } })}>Track its status</Button>
          <Button variant="outline" asChild><Link to="/support">Find support</Link></Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Report an incident</h1>
        <button className="text-sm text-muted-foreground underline" onClick={() => navigate({ to: "/" })}>Save & exit</button>
      </div>
      <div className="mt-4 flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => <div key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />)}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>

      <div className="mt-6">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground">How do you know about this incident? There's no wrong answer. This just helps others understand the report.</p>
            {REPORT_TYPES.map((t) => (
              <Option key={t.value} active={d.reportType === t.value} onClick={() => set({ reportType: t.value })} title={t.label} body={t.explain} />
            ))}
            {d.reportType === "disclosed" && (
              <div className="mt-4 rounded-2xl bg-muted p-4">
                <p className="text-sm font-semibold">Did the person agree to you sharing this?</p>
                <p className="mt-1 text-xs text-muted-foreground">We never ask who they are. Please leave out anything that could identify them.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {([["consented", "Yes, they agreed"], ["not_sure", "I'm not sure"], ["not_asked", "I didn't ask"]] as const).map(([v, l]) => (
                    <Option key={v} compact active={d.consent === v} onClick={() => set({ consent: v })} title={l} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label>What kind of incident?</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {CATEGORIES.map((c) => (
                  <button key={c.value} type="button" onClick={() => set({ category: c.value })}
                    className={cn("flex items-start gap-3 rounded-2xl border bg-card p-4 text-left", d.category === c.value && "border-primary bg-secondary")}>
                    <CategoryIcon category={c.value} className="mt-0.5 size-5 text-primary" />
                    <span><span className="block font-semibold">{c.label}</span><span className="text-sm text-muted-foreground">{c.hint}</span></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="df">Approximate date (or start)</Label><Input id="df" type="date" max={today()} value={d.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="dt">End of period <span className="text-muted-foreground">(optional)</span></Label><Input id="dt" type="date" max={today()} value={d.dateTo} onChange={(e) => set({ dateTo: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr">Time of day <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="tr" placeholder="e.g. evening" maxLength={40} value={d.timeRange} onChange={(e) => set({ timeRange: e.target.value })} />
              <p className="text-xs text-muted-foreground">Only shared with moderators. Never shown publicly.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds">What happened? <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea id="ds" rows={5} maxLength={1000} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Share only what you're comfortable with. Please don't name anyone." />
              <p className="text-right text-xs text-muted-foreground">{d.description.length}/1000</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cx">Helpful context <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="cx" maxLength={300} value={d.context} onChange={(e) => set({ context: e.target.value })} placeholder="e.g. on a bus, poorly lit lane" />
            </div>
            {identifying && <Warn>Your text looks like it may include a phone number, email or social handle. Please remove anything that could identify a person.</Warn>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-muted-foreground">Search for a place or tap the map near where it happened. A rough spot is enough. We never ask for your GPS.</p>
            <PlaceSearch onPick={(p) => { setCenter({ lat: p.lat, lng: p.lng }); set({ point: { lat: p.lat, lng: p.lng }, placeLabel: p.label }); }} />
            <div className="relative h-80 overflow-hidden rounded-2xl border">
              <LocationPicker value={d.point} center={center} onChange={(p) => set({ point: p })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl">Area name <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="pl" maxLength={200} value={d.placeLabel} onChange={(e) => set({ placeLabel: e.target.value })} placeholder="e.g. Mirpur 10 roundabout" />
            </div>
            <p className="text-xs text-muted-foreground">If published, the pin is moved to a rough area a few hundred metres wide. Your exact point stays private.</p>
          </div>
        )}

        {step === 3 && d.reportType && d.category && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card p-4">
                <p className="flex items-center gap-2 font-semibold"><Eye className="size-4 text-primary" /> May appear publicly</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>{categoryLabel(d.category)}</li>
                  <li>{reportTypeLabel(d.reportType)}</li>
                  <li>A rough area, not the exact spot</li>
                  <li>A date window, not the exact date or time</li>
                  <li>A short summary written or edited by a moderator</li>
                </ul>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <p className="flex items-center gap-2 font-semibold"><EyeOff className="size-4 text-primary" /> Always private</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>Who you are and your account</li>
                  <li>Your exact location point</li>
                  <li>Time of day and exact date</li>
                  <li>Your original words</li>
                  {d.reportType === "disclosed" && <li>Whether the person agreed to sharing</li>}
                </ul>
              </div>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>A moderator reviews every report. They may ask you a question privately.</li>
              <li>Submitting does not guarantee publication.</li>
              <li>You can withdraw your report at any time from "My reports".</li>
            </ul>
            {identifying && <Warn>Your description may include identifying details. Moderators will remove them before anything is published.</Warn>}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft className="size-4" /> Back</Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue <ArrowRight className="size-4" /></Button>
        ) : (
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send report privately"}</Button>
        )}
      </div>
    </PageContainer>
  );
}

function Option({ active, onClick, title, body, compact }: { active: boolean; onClick: () => void; title: string; body?: string; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("w-full rounded-2xl border bg-card text-left transition", compact ? "p-3 text-sm" : "p-4", active && "border-primary bg-secondary")}>
      <span className="block font-semibold">{title}</span>
      {body && <span className="text-sm text-muted-foreground">{body}</span>}
    </button>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return <p className="flex gap-2 rounded-xl bg-warning/15 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{children}</p>;
}
