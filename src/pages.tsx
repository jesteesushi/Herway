import { useEffect, useMemo, useState } from "react";
import { Phone, X, Sparkles, Flag, LifeBuoy } from "lucide-react";
import { IncidentMap } from "@/components/ClientMap";
import { CategoryBadge, ReportTypeBadge } from "@/components/CategoryBadge";
import { PageContainer } from "@/components/AppShell";
import { supabase, hasBackend } from "@/integrations/supabase/client";
import { CATEGORIES, PERIODS, NOTICE, SAMPLE_INCIDENTS, type Category, type PublishedIncident } from "@/lib/herway";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition", on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary");

export function Explore() {
  const [all, setAll] = useState<PublishedIncident[]>(SAMPLE_INCIDENTS);
  const [cats, setCats] = useState<Category[]>([]);
  const [days, setDays] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [info, setInfo] = useState(false);

  useEffect(() => {
    if (!hasBackend) return;
    supabase.from("published_incidents").select("*").then(({ data }) => data?.length && setAll(data as PublishedIncident[]));
  }, []);

  const shown = useMemo(() => all.filter((i) =>
    (!cats.length || cats.includes(i.category)) &&
    (!days || Date.now() - new Date(i.date_to).getTime() <= days * 864e5)), [all, cats, days]);
  const current = shown.find((i) => i.id === sel) ?? null;
  const isSample = all.some((i) => i.is_sample);

  return (
    <div className="relative h-[calc(100dvh-9.5rem)] md:h-dvh">
      <IncidentMap incidents={shown} selectedId={sel} onSelect={setSel} flyTo={null} />
      <div className="pointer-events-none absolute inset-x-0 top-0 space-y-2 p-3">
        <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button key={c.value} className={chip(cats.includes(c.value))} aria-pressed={cats.includes(c.value)}
              onClick={() => setCats((p) => p.includes(c.value) ? p.filter((x) => x !== c.value) : [...p, c.value])}>{c.label}</button>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-1">
          {PERIODS.map((p) => <button key={p.d} className={chip(days === p.d)} onClick={() => setDays(p.d)}>{p.label}</button>)}
          <button className={chip(false)} onClick={() => setInfo(true)}>About this data</button>
        </div>
        {isSample && <p className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground shadow-soft"><Sparkles className="size-3.5" />Sample data for preview — not real reports</p>}
      </div>
      {!shown.length && <p className="absolute inset-x-6 top-1/2 rounded-2xl bg-card p-4 text-center text-sm shadow-soft">No reports match these filters. This does not mean the area is safe.</p>}
      {current && (
        <section className="absolute inset-x-3 bottom-3 rounded-3xl border bg-card p-5 shadow-soft md:inset-x-auto md:right-4 md:top-4 md:bottom-auto md:w-80">
          <button aria-label="Close" onClick={() => setSel(null)} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full hover:bg-muted"><X className="size-4" /></button>
          <div className="flex flex-wrap gap-2 pr-8"><CategoryBadge category={current.category} /><ReportTypeBadge type={current.report_type} /></div>
          <h2 className="mt-3 font-display text-lg font-semibold">{current.area_label}</h2>
          <p className="text-xs text-muted-foreground">{fmt(current.date_from)} · Community report, reviewed by moderators (not verified)</p>
          {current.summary && <p className="mt-3 text-sm leading-relaxed">{current.summary}</p>}
          <div className="mt-4 flex gap-2">
            <button className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold hover:bg-muted"><Flag className="size-3.5" />Flag or correct</button>
            <Link to="/support" className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"><LifeBuoy className="size-3.5" />Support</Link>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{NOTICE}</p>
        </section>
      )}
      {info && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-foreground/30 p-4" onClick={() => setInfo(false)}>
          <div className="max-w-sm rounded-3xl bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">About this data</h2>
            <p className="mt-2 text-sm leading-relaxed">{NOTICE}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pins sit at generalised locations. Colours and icons describe the type of report, never how reliable it is or how safe an area is.</p>
            <button className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => setInfo(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

const RESOURCES = [
  { name: "National Emergency Service", phone: "999", d: "Police, fire service and ambulance." },
  { name: "National Helpline for Violence against Women and Children", phone: "109", d: "Government helpline for women and children facing violence." },
];
export function Support() {
  return (
    <PageContainer>
      <h1 className="font-display text-3xl font-semibold">Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">HerWay is not an emergency service and cannot send help. No account needed here.</p>
      <div className="mt-6 space-y-3">
        {RESOURCES.map((r) => (
          <a key={r.phone} href={`tel:${r.phone}`} className="flex items-center gap-4 rounded-3xl border bg-card p-4 shadow-soft transition hover:bg-muted">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Phone className="size-5" /></span>
            <span><b className="block">{r.name} · {r.phone}</b><span className="text-sm text-muted-foreground">{r.d}</span>
              <span className="mt-1 block text-[11px] font-semibold text-secondary-foreground">Proposed resource — number and hours not yet verified</span></span>
          </a>
        ))}
      </div>
    </PageContainer>
  );
}

export function Soon({ title }: { title: string }) {
  return (
    <PageContainer className="text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-secondary text-primary"><Sparkles className="size-7" /></div>
      <h1 className="mt-4 font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">This part of HerWay is coming soon.</p>
      <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Back to Explore</Link>
    </PageContainer>
  );
}
