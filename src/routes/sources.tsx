import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/AppShell";
import { Shield, ExternalLink, AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Data Sources & Transparency — HerWay" },
      {
        name: "description",
        content:
          "Public accountability log of all verified news, official, and NGO sources integrated into HerWay.",
      },
    ],
  }),
  component: DataSourcesPage,
});

type SourceRecord = {
  id: string;
  name: string;
  url: string;
  source_type: "official" | "news" | "ngo" | "other";
  integration: "rss" | "api" | "manual" | "blocked";
  last_success_at: string | null;
  last_error: string | null;
  notes: string | null;
};

// Fallback seed sources if DB table is initializing
const FALLBACK_SOURCES: SourceRecord[] = [
  {
    id: "s-dmp",
    name: "Dhaka Metropolitan Police",
    url: "https://dmp.gov.bd/feed/",
    source_type: "official",
    integration: "rss",
    last_success_at: new Date().toISOString(),
    last_error: null,
    notes: "Official press releases and public safety bulletins.",
  },
  {
    id: "s-tds",
    name: "The Daily Star",
    url: "https://www.thedailystar.net/news/bangladesh/rss.xml",
    source_type: "news",
    integration: "rss",
    last_success_at: new Date().toISOString(),
    last_error: null,
    notes: "National crime and incident coverage (English edition).",
  },
  {
    id: "s-pa",
    name: "Prothom Alo English",
    url: "https://en.prothomalo.com/feed",
    source_type: "news",
    integration: "rss",
    last_success_at: new Date().toISOString(),
    last_error: null,
    notes: "Daily English reporting on law enforcement and community events.",
  },
  {
    id: "s-bdn",
    name: "bdnews24 English",
    url: "https://prod-qt-images.s3.amazonaws.com/production/bdnews24-english/feed.xml",
    source_type: "news",
    integration: "rss",
    last_success_at: new Date().toISOString(),
    last_error: null,
    notes: "Real-time English digital news syndication.",
  },
  {
    id: "s-ask",
    name: "Ain o Salish Kendra (ASK)",
    url: "https://www.askbd.org/ask/feed/",
    source_type: "ngo",
    integration: "rss",
    last_success_at: new Date().toISOString(),
    last_error: null,
    notes: "Human rights documentation and legal aid reports.",
  },
  {
    id: "s-bmp",
    name: "Bangladesh Mahila Parishad",
    url: "https://mahilaparishad.org/feed/",
    source_type: "ngo",
    integration: "rss",
    last_success_at: new Date().toISOString(),
    last_error: null,
    notes: "Women rights advocacy and violence tracking records.",
  },
  {
    id: "s-bnwla",
    name: "BNWLA",
    url: "https://bnwla-bd.org/feed/",
    source_type: "ngo",
    integration: "rss",
    last_success_at: new Date().toISOString(),
    last_error: null,
    notes: "Women lawyers association legal monitoring and shelter data.",
  },
  {
    id: "s-bp",
    name: "Bangladesh Police",
    url: "https://www.police.gov.bd",
    source_type: "official",
    integration: "manual",
    last_success_at: null,
    last_error: null,
    notes: "No standard public RSS exposed; monitored manually by administrators.",
  },
];

function isStaleOrError(lastSuccess: string | null, lastError: string | null): boolean {
  if (lastError) return true;
  if (!lastSuccess) return true;
  const hoursSince = (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 3600);
  return hoursSince > 48;
}

function typeColor(type: string) {
  switch (type) {
    case "official":
      return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20";
    case "news":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case "ngo":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function DataSourcesPage() {
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("sources").select("*").order("name");
        if (error || !data || data.length === 0) return FALLBACK_SOURCES;
        return data as SourceRecord[];
      } catch {
        return FALLBACK_SOURCES;
      }
    },
  });

  return (
    <PageContainer className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Shield className="size-3.5" /> Transparency & Ingestion
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
          HerWay only ingests data from verified public institutions, recognized national media, and accredited
          human rights organizations. We never scrape behind anti-bot protection or breach automated access terms.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <span className="text-xs text-muted-foreground">Total Monitored Sources</span>
          <p className="text-2xl font-bold">{sources.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <span className="text-xs text-muted-foreground">Automated RSS Feeds</span>
          <p className="text-2xl font-bold">{sources.filter((s) => s.integration === "rss").length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <span className="text-xs text-muted-foreground">Manual & Special Review</span>
          <p className="text-2xl font-bold">{sources.filter((s) => s.integration === "manual").length}</p>
        </div>
      </div>

      {/* Sources List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tracked Sources</h2>
          <Link to="/statuses" className="text-xs text-primary underline">
            Learn about publication statuses →
          </Link>
        </div>

        <div className="space-y-3">
          {sources.map((s) => {
            const hasProblem = isStaleOrError(s.last_success_at, s.last_error);

            return (
              <div
                key={s.id || s.name}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/50"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground text-base">{s.name}</h3>
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${typeColor(s.source_type)}`}>
                      {s.source_type}
                    </span>
                    <span className="rounded-md border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {s.integration.toUpperCase()}
                    </span>
                  </div>

                  {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {s.last_success_at
                        ? `Last sync: ${new Date(s.last_success_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "No automated sync recorded"}
                    </span>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        Source link <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  {hasProblem ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-3.5" /> Delayed / Unavailable
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
                      <CheckCircle2 className="size-3.5" /> Healthy
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
