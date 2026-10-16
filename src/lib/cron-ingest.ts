import { createClient } from "@supabase/supabase-js";
import { ingestSource } from "@/lib/ingest/rss";

export async function handleCronIngest(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  // Verify CRON_SECRET if configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const db = createClient(supabaseUrl, serviceRoleKey);
  const { data: sources, error } = await db
    .from("sources")
    .select("*")
    .eq("integration", "rss");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = [];
  for (const s of sources ?? []) {
    results.push(await ingestSource(s));
  }

  return new Response(JSON.stringify({ success: true, count: results.length, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
