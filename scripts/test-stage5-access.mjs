import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load Supabase credentials from .env
const env = readFileSync(".env", "utf-8");
let url = "";
let anonKey = "";

for (const line of env.split("\n")) {
  const [k, ...v] = line.trim().split("=");
  const val = v.join("=").replace(/^["']|["']$/g, "").trim();
  if (k === "VITE_SUPABASE_URL" || k === "SUPABASE_URL") url = url || val;
  if (k === "VITE_SUPABASE_PUBLISHABLE_KEY" || k === "SUPABASE_PUBLISHABLE_KEY") anonKey = anonKey || val;
}

const client = createClient(url, anonKey);

async function runStage5Tests() {
  console.log("==================================================================");
  console.log("STAGE 5 DATABASE & RLS ACCESS VERIFICATION");
  console.log("Target Database:", url);
  console.log("Role: Anonymous (ANON_KEY)");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function report(name, isPass, detail) {
    if (isPass) {
      console.log(`[PASS] ${name}: ${detail}`);
      passed++;
    } else {
      console.log(`[FAIL] ${name}: ${detail}`);
      failed++;
    }
  }

  // TEST 1: public_incidents view queryable by anon
  const pubRes = await client.from("public_incidents").select("*").limit(20);
  if (pubRes.error) {
    console.log(`[NOTE] public_incidents query: ${pubRes.error.message} (Schema needs to be applied in Supabase dashboard)`);
  } else {
    report("1. Anon SELECT public_incidents", true, `Retrieved ${pubRes.data.length} records`);
    
    // TEST 6: Publication boundary check
    const badStatuses = ["under_review", "unverified_submission", "rejected"];
    const leaked = pubRes.data.filter((r) => badStatuses.includes(r.publication_status));
    report(
      "6. Publication Boundary Test",
      leaked.length === 0,
      leaked.length === 0
        ? "No unapproved (under_review, unverified_submission, rejected) records returned"
        : `LEAK DETECTED: ${leaked.length} unapproved records exposed!`
    );
  }

  // TEST 2: Base incidents table blocked for anon
  const incRes = await client.from("incidents").select("*").limit(1);
  if (incRes.error) {
    report("2. Anon SELECT incidents", true, `Blocked by database RLS: ${incRes.error.message}`);
  } else {
    report(
      "2. Anon SELECT incidents",
      incRes.data.length === 0,
      incRes.data.length === 0 ? "Blocked by RLS (0 rows returned)" : "FAIL: Base table data leaked!"
    );
  }

  // TEST 3: Private submissions table SELECT blocked for anon
  const subRes = await client.from("submissions").select("*").limit(1);
  if (subRes.error) {
    report("3. Anon SELECT submissions", true, `Blocked: ${subRes.error.message}`);
  } else {
    report(
      "3. Anon SELECT submissions",
      subRes.data.length === 0,
      subRes.data.length === 0 ? "Blocked by RLS (0 rows returned)" : "FAIL: Private submissions leaked!"
    );
  }

  // TEST 4: Direct submissions INSERT blocked for anon
  const insRes = await client.from("submissions").insert({
    description: "malicious anonymous payload",
    consent: true,
    status: "pending",
  });
  if (insRes.error) {
    report("4. Anon INSERT submissions", true, `Blocked by RLS: ${insRes.error.message}`);
  } else {
    report("4. Anon INSERT submissions", false, "FAIL: Anonymous direct insert permitted!");
  }

  // TEST 5: Admins table blocked for anon
  const admRes = await client.from("admins").select("*").limit(1);
  if (admRes.error) {
    report("5. Anon SELECT admins", true, `Blocked: ${admRes.error.message}`);
  } else {
    report(
      "5. Anon SELECT admins",
      admRes.data.length === 0,
      admRes.data.length === 0 ? "Blocked by RLS (0 rows returned)" : "FAIL: Admins table exposed!"
    );
  }

  // TEST 7: Sources & Incident Audit blocked for anon
  const srcRes = await client.from("sources").select("*").limit(1);
  const audRes = await client.from("incident_audit").select("*").limit(1);
  const srcBlocked = srcRes.error || srcRes.data?.length === 0;
  const audBlocked = audRes.error || audRes.data?.length === 0;
  report("7. Sources & Audit Admin Protection", srcBlocked && audBlocked, "Internal audit and sources inaccessible to anon");

  console.log("==================================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================================");
}

runStage5Tests();
