import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, HeartHandshake, EyeOff, AlertTriangle, Scale, ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/AppShell";

export const Route = createFileRoute("/guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — HerWay" },
      { name: "description", content: "Rules and principles to keep the HerWay community and incident map safe, discreet, and supportive." },
      { property: "og:title", content: "Community Guidelines — HerWay" },
      { property: "og:description", content: "Rules and principles to keep HerWay safe, discreet, and supportive." },
    ],
  }),
  component: GuidelinesPage,
});

export function GuidelinesPage() {
  return (
    <PageContainer className="max-w-3xl pb-16">
      <Link to="/community" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline mb-4">
        <ArrowLeft className="size-3.5" /> Back to Community
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight">Community Guidelines</h1>
      <p className="mt-2 text-base text-muted-foreground leading-relaxed">
        HerWay is a community platform dedicated to helping women and girls in Bangladesh navigate public spaces safely.
        To maintain a compassionate, secure, and privacy-respecting environment, everyone who participates must uphold these principles.
      </p>

      <div className="mt-8 space-y-6">
        {/* Guideline 1 */}
        <section className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <EyeOff className="size-5" />
            </span>
            <h2 className="text-lg font-semibold">1. Zero Tolerance for Personal Contact Details & Doxxing</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Never post names, phone numbers, email addresses, social media links, or exact house/flat numbers — whether yours or someone else's.
            Automatic filters check for phone numbers and handles, but intentional attempts to publish identifying information will result in immediate removal and permanent account blocking.
          </p>
        </section>

        {/* Guideline 2 */}
        <section className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
              <HeartHandshake className="size-5" />
            </span>
            <h2 className="text-lg font-semibold">2. Respectful, Supportive, and Non-Judgmental Discussions</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We believe survivors. Victim-blaming, derogatory language, harassment, gaslighting, or dismissive attitudes are strictly prohibited.
            When replying to experiences in community rooms, focus on empathy, validation, and practical precautions.
          </p>
        </section>

        {/* Guideline 3 */}
        <section className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <h2 className="text-lg font-semibold">3. Sharing Disclosed Reports with Consent</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you are submitting an incident that was told to you by a friend, family member, or colleague, only report it if you have their consent to share.
            Never reveal their identity or specific private details that could connect the report back to them in their school, workplace, or neighborhood.
          </p>
        </section>

        {/* Guideline 4 */}
        <section className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
              <Scale className="size-5" />
            </span>
            <h2 className="text-lg font-semibold">4. How Reports & Content Are Moderated</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Incident reports never appear publicly without human moderator review. Precise coordinates are snapped to a generalized grid (~450 m) on our server before publication.
            If a report is declined, the reporter can communicate privately with moderators or submit a formal appeal through their status page.
          </p>
        </section>

        {/* Guideline 5 */}
        <section className="rounded-3xl border border-warning/30 bg-warning/10 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-warning/20 text-warning-foreground">
              <AlertTriangle className="size-5 text-amber-600" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">5. In Danger? Contact Emergency Services Directly</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            HerWay is a documentation and mutual-support tool, not a first-response emergency dispatcher.
            If you or someone around you is in immediate physical danger, please immediately call <a href="tel:999" className="font-semibold text-foreground underline">999</a> (National Emergency) or <a href="tel:109" className="font-semibold text-foreground underline">109</a> (Helpline for Violence Against Women).
          </p>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/community" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Go to Community Rooms
        </Link>
        <Link to="/report" className="rounded-full border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted">
          Report an Incident
        </Link>
        <Link to="/support" className="rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground">
          Emergency Support Resources
        </Link>
      </div>
    </PageContainer>
  );
}
