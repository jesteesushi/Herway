import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer } from "@/components/AppShell";
import { ShieldCheck, AlertCircle, FileSearch, HelpCircle, RotateCcw, Ban, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/statuses")({
  head: () => ({
    meta: [
      { title: "Publication Statuses & Verification — HerWay" },
      {
        name: "description",
        content: "Detailed guide to how HerWay reviews, categorizes, and publishes community safety reports.",
      },
    ],
  }),
  component: StatusesPage,
});

const STATUS_DEFINITIONS = [
  {
    key: "official_alert",
    title: "Official Alert",
    badge: "Public on Map",
    tone: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30",
    icon: ShieldCheck,
    description:
      "Alerts, notices, or incident advisories issued directly by law enforcement agencies, government ministries, or public transport authorities.",
    rules: [
      "Must have a verifiable public agency reference or circular.",
      "Given highest placement priority in route corridor safety briefings.",
      "Does not reveal private reporter identity or sensitive survivor information.",
    ],
  },
  {
    key: "source_reported",
    title: "Source Reported",
    badge: "Public on Map",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    icon: AlertCircle,
    description:
      "Incidents reported by accredited national news organizations or verified human rights monitoring NGOs.",
    rules: [
      "Must include a direct link to the original published article or report.",
      "Summaries are restricted to brief contextual descriptions without uncorroborated allegations.",
      "Locations are snapped to approximate road, locality, or district boundaries.",
    ],
  },
  {
    key: "under_review",
    title: "Under Review",
    badge: "Internal Only (Hidden from Public)",
    tone: "bg-muted text-muted-foreground border-border",
    icon: FileSearch,
    description:
      "Freshly ingested RSS items and user submissions awaiting human review by trained moderators.",
    rules: [
      "Never displayed on public maps or accessible via public APIs.",
      "Moderators inspect for personal identifying details, abusive language, or privacy hazards.",
      "Coordinates are jittered and rounded before any approval step.",
    ],
  },
  {
    key: "unverified_submission",
    title: "Unverified Submission",
    badge: "Private Only",
    tone: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
    icon: HelpCircle,
    description:
      "Reports submitted without sufficient location detail, corroboration, or explicit privacy clearance.",
    rules: [
      "Kept strictly within private reviewer queues or private reporter archives.",
      "May be reassessed if secondary corroborating reports emerge in the same corridor.",
      "Never exported to public GeoJSON or route analysis algorithms.",
    ],
  },
  {
    key: "corrected_retracted",
    title: "Corrected / Retracted",
    badge: "Public with Clarification Notice",
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
    icon: RotateCcw,
    description:
      "Incidents that were previously published but later clarified, updated, or retracted following an appeal or community flag.",
    rules: [
      "Maintains transparency by documenting why an update or retraction occurred.",
      "Audit trail recorded in incident_audit with moderator reason.",
      "Prevents misinformation or outdated warnings from lingering uncorrected.",
    ],
  },
];

function StatusesPage() {
  return (
    <PageContainer className="max-w-3xl space-y-8">
      <div>
        <Link to="/sources" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-3">
          <ArrowLeft className="size-3.5" /> Back to Data Sources
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Publication Statuses</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          HerWay uses strict publication rules to protect personal privacy and ensure community safety information
          is truthful, accountable, and transparent. Here is how each report status is defined and handled.
        </p>
      </div>

      <div className="space-y-5">
        {STATUS_DEFINITIONS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="rounded-2xl border bg-card p-5 space-y-3 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.tone}`}>
                  {s.badge}
                </span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>

              <div className="rounded-xl bg-muted/60 p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-foreground">Publication & Privacy Rules:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  {s.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
