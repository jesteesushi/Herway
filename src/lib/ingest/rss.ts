import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

const KEYWORDS = /(harass|eve[- ]?teas|stalk|assault|rape|snatch|abduct|women|girl|safety|police|arrest|violence|court|victim)/i;

/** Safely extracts text content even if xml2js parses tags as objects without toString */
function extractString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    const anyVal = val as any;
    if (typeof anyVal._ === "string") return anyVal._.trim();
    if (Array.isArray(anyVal.a) && anyVal.a[0]) {
      const a0 = anyVal.a[0];
      if (typeof a0 === "string") return a0.trim();
      if (typeof a0?._ === "string") return a0._.trim();
    }
    for (const v of Object.values(anyVal)) {
      if (typeof v === "string") return v.trim();
      if (typeof v === "object" && v && typeof (v as any)._ === "string") {
        return (v as any)._.trim();
      }
    }
  }
  try {
    return String(val ?? "").trim();
  } catch {
    return "";
  }
}

export async function ingestSource(source: { id: string; url: string; name: string; source_type: string }) {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[ingestSource] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return { ok: false, error: "missing_credentials" };
  }

  const db = createClient(supabaseUrl, serviceRoleKey);
  try {
    const parser = new Parser({
      timeout: 15000,
      headers: { "User-Agent": "HerWay/1.0 (safety-monitor@herway.app)" },
    });
    const feed = await parser.parseURL(source.url);

    const rows = (feed.items ?? [])
      .map((i) => {
        const title = extractString(i.title);
        const snippet = extractString(i.contentSnippet || i.content);
        const link = extractString(i.link);
        const guid = extractString(i.guid) || link || `${source.id}-${Date.now()}-${Math.random()}`;
        return {
          source_id: source.id,
          source_item_id: guid,
          source_name: source.name,
          source_url: link || source.url,
          source_type: source.source_type,
          title,
          snippet,
          summary: (snippet || title).slice(0, 400),
          source_published_at: i.isoDate ? new Date(i.isoDate).toISOString() : new Date().toISOString(),
          location_precision: "unknown" as const,
          publication_status: "under_review" as const,
          last_checked_at: new Date().toISOString(),
        };
      })
      .filter((i) => KEYWORDS.test(`${i.title} ${i.snippet}`))
      .map(({ title, snippet, ...row }) => row);

    if (rows.length) {
      await db.from("incidents").upsert(rows, {
        onConflict: "source_id,source_item_id",
        ignoreDuplicates: true,
      });
    }

    await db
      .from("sources")
      .update({ last_success_at: new Date().toISOString(), last_error: null })
      .eq("id", source.id);

    return { ok: true, count: rows.length };
  } catch (e: any) {
    const errorMsg = String(e?.message ?? e).slice(0, 300);
    try {
      await db.from("sources").update({ last_error: errorMsg }).eq("id", source.id);
    } catch {
      // ignore
    }
    return { ok: false, error: errorMsg };
  }
}
