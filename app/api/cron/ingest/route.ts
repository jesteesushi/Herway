import { createClient } from "@supabase/supabase-js";
import { ingestSource } from "@/lib/ingest/rss";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const db = createClient(supabaseUrl, serviceRoleKey);
  const { data } = await db.from("sources").select("*").eq("integration", "rss");
  const results = [];
  for (const s of data ?? []) {
    results.push(await ingestSource(s));
  }
  return Response.json(results);
}
