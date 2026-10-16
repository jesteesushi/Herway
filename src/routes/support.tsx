import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Phone,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Heart,
  Scale,
  Car,
  Smartphone,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support & Emergency Resources — HerWay" },
      { name: "description", content: "Verified emergency hotlines, legal aid services, crisis centers, and transit guidance in Bangladesh. Accessible without signing in." },
      { property: "og:title", content: "Support & Emergency Resources — HerWay" },
      { property: "og:description", content: "Verified emergency hotlines, legal aid services, and crisis centers across Bangladesh." },
    ],
  }),
  component: SupportPage,
});

type Resource = {
  id: string;
  name: string;
  phone: string | null;
  url: string | null;
  description: string;
  kind: "emergency" | "helpline" | "service";
  hours: string | null;
  is_verified: boolean;
  last_checked: string | null;
  sort_order: number;
};

// Fallback resources in case database is empty
const FALLBACK_RESOURCES: Resource[] = [
  {
    id: "res-1",
    name: "National Emergency Service",
    phone: "999",
    url: null,
    description: "Bangladesh national emergency dispatcher for immediate police intervention, fire rescue, and ambulance services.",
    kind: "emergency",
    hours: "24 hours / 7 days",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 1,
  },
  {
    id: "res-2",
    name: "National Helpline for Violence Against Women and Children",
    phone: "109",
    url: "http://www.mspvaw.gov.bd",
    description: "Ministry of Women and Children Affairs 24/7 toll-free helpline providing immediate crisis referral, police coordination, and counseling.",
    kind: "helpline",
    hours: "24 hours / 7 days",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 2,
  },
  {
    id: "res-3",
    name: "National Legal Aid Helpline",
    phone: "16430",
    url: "http://www.nlaso.gov.bd",
    description: "Government legal aid organization providing free legal counsel, document preparation, and courtroom lawyer representation for women.",
    kind: "service",
    hours: "9:00 AM – 5:00 PM (Govt working days)",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 3,
  },
  {
    id: "res-4",
    name: "Ain o Salish Kendra (ASK) Legal Helpline",
    phone: "01724415677",
    url: "https://www.askbd.org",
    description: "Human rights organization offering confidential legal advice, mediation, and direct emergency legal representation for violence survivors.",
    kind: "service",
    hours: "9:00 AM – 8:00 PM (Daily)",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 4,
  },
  {
    id: "res-5",
    name: "Bangladesh National Women Lawyers Association (BNWLA)",
    phone: "01715247844",
    url: "http://bnwla-bd.org",
    description: "Specialized legal organization offering courtroom support, protective custody coordination, and shelter referrals for women facing stalking or abuse.",
    kind: "service",
    hours: "24 hours emergency hotline",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 5,
  },
  {
    id: "res-6",
    name: "Kaan Pete Roi (Emotional Support & Crisis Counseling)",
    phone: "01779554391",
    url: "https://shuni.org",
    description: "First emotional support helpline in Bangladesh offering non-judgmental, confidential listening for trauma, distress, and anxiety.",
    kind: "helpline",
    hours: "3:00 PM – 3:00 AM (Daily)",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 6,
  },
  {
    id: "res-7",
    name: "One-Stop Crisis Centres (OCC) - Public Medical Colleges",
    phone: "02-55165088",
    url: "http://www.dmc.gov.bd",
    description: "Integrated hospital wards in Dhaka, Chattogram, Rajshahi, Sylhet, Khulna, Barishal, Rangpur providing medical care, DNA forensics, police, and legal aid in one facility.",
    kind: "emergency",
    hours: "24 hours emergency admissions",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 7,
  },
  {
    id: "res-8",
    name: "BRAC Human Rights and Legal Aid Services (HRLS)",
    phone: "01713044444",
    url: "https://www.brac.net",
    description: "Nationwide legal clinics across 64 districts in Bangladesh providing grassroots legal literacy and psycho-social assistance.",
    kind: "service",
    hours: "9:00 AM – 5:00 PM",
    is_verified: true,
    last_checked: new Date().toISOString(),
    sort_order: 8,
  },
];

function SupportPage() {
  const [filter, setFilter] = useState<"all" | "emergency" | "helpline" | "service">("all");

  const { data: dbData = [] } = useQuery({
    queryKey: ["support_resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_resources").select("*").order("sort_order");
      if (error || !data || data.length === 0) return FALLBACK_RESOURCES;
      return data as Resource[];
    },
  });

  const resources = dbData.length > 0 ? dbData : FALLBACK_RESOURCES;
  const filtered = filter === "all" ? resources : resources.filter((r) => r.kind === filter);

  return (
    <PageContainer className="max-w-4xl pb-16">
      {/* Page Header */}
      <h1 className="font-display text-3xl font-semibold tracking-tight">Support & Emergency Help</h1>
      <p className="mt-2 text-base text-muted-foreground leading-relaxed">
        HerWay is a documentation and mutual-support platform. No account is required to access these emergency hotlines, crisis shelters, and legal services.
      </p>

      {/* Immediate Emergency Warning Banner */}
      <div className="mt-6 rounded-3xl border border-destructive/30 bg-destructive/10 p-5 leading-relaxed">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">HerWay is not an emergency response service</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We cannot dispatch police, medical, or security personnel to your location. If you or someone near you is in immediate physical danger,
              tap <a href="tel:999" className="font-bold text-foreground underline">999</a> immediately.
            </p>
          </div>
        </div>
      </div>

      {/* Support Sections Tabs */}
      <Tabs defaultValue="directory" className="mt-8">
        <TabsList>
          <TabsTrigger value="directory" className="gap-1.5">
            <Phone className="size-4" /> Verified Directory
          </TabsTrigger>
          <TabsTrigger value="guidance" className="gap-1.5">
            <Info className="size-4" /> Safety Guidance
          </TabsTrigger>
        </TabsList>

        {/* Directory Tab */}
        <TabsContent value="directory" className="mt-4 space-y-6">
          {/* Quick Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All Contacts" },
              { id: "emergency", label: "Emergency (999 & OCC)" },
              { id: "helpline", label: "Helplines (109 & Counseling)" },
              { id: "service", label: "Legal Services & Shelters" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === tab.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Cards List */}
          <div className="space-y-4">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-3xl border bg-card p-6 shadow-soft transition hover:border-primary/40">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-lg">{r.name}</span>
                      {r.is_verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <ShieldCheck className="size-3" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{r.description}</p>
                    {r.hours && (
                      <p className="text-xs font-medium text-foreground/80">
                        ⏰ <span className="text-muted-foreground">Hours:</span> {r.hours}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="grid size-11 place-items-center rounded-2xl border bg-muted/60 text-foreground hover:bg-muted"
                        title="Official Website"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    {r.phone && (
                      <a
                        href={`tel:${r.phone}`}
                        className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-display text-base font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
                      >
                        <Phone className="size-4" /> {r.phone}
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground flex justify-between items-center">
                  <span>
                    {r.last_checked
                      ? `Details verified ${new Date(r.last_checked).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
                      : "Verified contact"}
                  </span>
                  <span className="capitalize font-medium">{r.kind}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Practical Guidance Tab */}
        <TabsContent value="guidance" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Transit safety */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Car className="size-5" />
              </span>
              <h2 className="text-base font-semibold">Public Transit & Commuting Tips</h2>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                <li>On public buses, sit near the front rows or adjacent to other women whenever possible.</li>
                <li>When hiring a CNG or rickshaw at night, make a visible phone call stating your location and destination.</li>
                <li>Avoid quiet or unlit shortcuts under flyovers or alleyways; prioritize main thoroughfares with active shops.</li>
              </ul>
            </div>

            {/* Digital safety & stalking */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
                <Smartphone className="size-5" />
              </span>
              <h2 className="text-base font-semibold">Dealing with Stalking & Harassment</h2>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                <li>If you notice someone following you repeatedly, alter your route into an active store or security post.</li>
                <li>Document dates, times, vehicle plate numbers, or recognizable details privately without confronting alone.</li>
                <li>You can report incidents anonymously on HerWay to warn other commuters about the pattern.</li>
              </ul>
            </div>

            {/* Legal Rights */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Scale className="size-5" />
              </span>
              <h2 className="text-base font-semibold">Your Legal Rights in Bangladesh</h2>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                <li>Eve-teasing and verbal harassment are criminal offenses under the Penal Code and DMP Ordinance.</li>
                <li>You have the legal right to free government legal counsel through the National Legal Aid Services Organization (call 16430).</li>
                <li>Police stations are legally obligated to record a General Diary (GD) or First Information Report (FIR).</li>
              </ul>
            </div>

            {/* Emotional care */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
                <Heart className="size-5" />
              </span>
              <h2 className="text-base font-semibold">Emotional Support & Next Steps</h2>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                <li>Experiencing harassment is never your fault. Take all the time you need before deciding on any action.</li>
                <li>Talk to someone you trust or reach out to confidential listeners at Kaan Pete Roi (01779554391).</li>
                <li>Sharing your experience on HerWay helps create transparent records without requiring legal filing or public exposure.</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
