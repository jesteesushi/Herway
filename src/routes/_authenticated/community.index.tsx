import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/community/")({
  head: () => ({ meta: [{ title: "Community rooms — HerWay" }, { name: "description", content: "Topic rooms where women in Bangladesh share practical safety advice under display names." }, { property: "og:title", content: "Community rooms — HerWay" }, { property: "og:description", content: "Moderated topic rooms for practical safety advice." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Rooms,
});

function Rooms() {
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await supabase.from("community_rooms").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["room-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("room_posts").select("room_id").is("removed_at", null);
      const c: Record<string, number> = {};
      (data ?? []).forEach((p) => (c[p.room_id] = (c[p.room_id] ?? 0) + 1));
      return c;
    },
  });
  return (
    <PageContainer>
      <h1 className="text-3xl font-semibold">Community</h1>
      <p className="mt-1 text-muted-foreground">Share experiences and practical advice. Only your display name is shown.</p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border bg-secondary p-4 text-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <p>Never post names, phone numbers, addresses or exact locations. Moderators review all reports.</p>
        </div>
        <Link to="/guidelines" className="shrink-0 text-xs font-semibold text-primary underline">
          Guidelines
        </Link>
      </div>
      {isLoading && <p className="mt-6 text-sm">Loading…</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {rooms.map((r) => (
          <Link key={r.id} to="/community/$slug" params={{ slug: r.slug }} className="rounded-2xl border bg-card p-5 hover:bg-muted">
            <h2 className="text-lg font-semibold">{r.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            <p className="mt-3 text-xs font-medium">{counts[r.id] ?? 0} posts</p>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
