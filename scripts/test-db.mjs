import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf-8");
let url = "";
let anonKey = "";

for (const line of env.split("\n")) {
  const [k, ...v] = line.trim().split("=");
  const val = v.join("=").replace(/^["']|["']$/g, "").trim();
  if (k === "VITE_SUPABASE_URL" || k === "SUPABASE_URL") url = url || val;
  if (k === "VITE_SUPABASE_PUBLISHABLE_KEY" || k === "SUPABASE_PUBLISHABLE_KEY") anonKey = anonKey || val;
}

console.log("Supabase URL:", url);
const client = createClient(url, anonKey);

async function run() {
  console.log("--- Testing Tables with Anonymous Key ---");

  // 1. public_incidents
  const r1 = await client.from("public_incidents").select("*").limit(2);
  console.log("public_incidents select:", r1.error ? `Error: ${r1.error.message}` : `Success (${r1.data?.length} rows)`);

  // 2. published_incidents
  const r2 = await client.from("published_incidents").select("*").limit(2);
  console.log("published_incidents select:", r2.error ? `Error: ${r2.error.message}` : `Success (${r2.data?.length} rows)`);

  // 3. incidents (base table - should fail or be blocked by RLS)
  const r3 = await client.from("incidents").select("*").limit(2);
  console.log("incidents select:", r3.error ? `Denied/Error: ${r3.error.message}` : `Rows: ${r3.data?.length}`);

  // 4. submissions (private - should fail or be blocked by RLS)
  const r4 = await client.from("submissions").select("*").limit(2);
  console.log("submissions select:", r4.error ? `Denied/Error: ${r4.error.message}` : `Rows: ${r4.data?.length}`);

  // 5. submissions anon insert
  const r5 = await client.from("submissions").insert({
    description: "test anon insert",
    consent: true,
    status: "pending",
  });
  console.log("submissions insert:", r5.error ? `Blocked: ${r5.error.message}` : "Allowed");

  // 6. admins (private - should fail or return 0 rows)
  const r6 = await client.from("admins").select("*").limit(2);
  console.log("admins select:", r6.error ? `Denied/Error: ${r6.error.message}` : `Rows: ${r6.data?.length}`);

  // 7. sources (admin only)
  const r7 = await client.from("sources").select("*").limit(2);
  console.log("sources select:", r7.error ? `Denied/Error: ${r7.error.message}` : `Rows: ${r7.data?.length}`);

  // 8. incident_audit (admin only)
  const r8 = await client.from("incident_audit").select("*").limit(2);
  console.log("incident_audit select:", r8.error ? `Denied/Error: ${r8.error.message}` : `Rows: ${r8.data?.length}`);
}

run();
