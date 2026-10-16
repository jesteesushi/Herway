import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/AppShell";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/herway";

export const Route = createFileRoute("/_authenticated/my-reports/")({
  head: () => ({ meta: [{ title: "My reports — HerWay" }, { name: "description", content: "Track the private status of reports you've submitted." }, { property: "og:title", content: "My reports — HerWay" }, { property: "og:description", content: "Your private report history." }] }),
  component: MyReports,
});

function MyReports() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-reports"],
    queryFn: async () => (await supabase.from("incident_reports").select("id, ref_code, category, status, created_at").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <PageContainer>
      <h1 className="text-3xl font-semibold">My reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">Only you can see this list.</p>
      {isLoading && <p className="mt-6 text-sm">Loading…</p>}
      {!isLoading && data.length === 0 && (
        <div className="mt-6 rounded-2xl border bg-card p-6 text-center">
          <p>You haven't submitted any reports.</p>
          <Button asChild className="mt-4"><Link to="/report">Report an incident</Link></Button>
        </div>
      )}
      <div className="mt-6 space-y-2">
        {data.map((r) => (
          <Link key={r.id} to="/my-reports/$id" params={{ id: r.id }} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 hover:bg-muted">
            <div>
              <CategoryBadge category={r.category} />
              <p className="mt-2 text-xs text-muted-foreground">{r.ref_code} · {new Date(r.created_at).toLocaleDateString("en-GB")}</p>
            </div>
            <span className="text-sm font-medium">{STATUS_LABEL[r.status]}</span>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
