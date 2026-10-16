#!/usr/bin/env node
/**
 * Safe script to assign the initial admin and moderator roles.
 * Usage:
 *   node scripts/bootstrap-moderator.mjs <user_id_or_email>
 *
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment or .env file.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env if present
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env");
  console.error("Please add SUPABASE_SERVICE_ROLE_KEY to your .env to run backend administrative scripts.");
  process.exit(1);
}

const target = process.argv[2]?.trim();
if (!target) {
  console.error("Usage: node scripts/bootstrap-moderator.mjs <user_id_or_email>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  console.log(`Connecting to ${SUPABASE_URL}...`);
  let userId = target;

  // Check if target is an email address
  if (target.includes("@")) {
    console.log(`Searching for user with email ${target}...`);
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("Failed to list users:", listError.message);
      process.exit(1);
    }
    const found = users.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (!found) {
      console.error(`User with email "${target}" not found. Has this user signed up yet?`);
      process.exit(1);
    }
    userId = found.id;
    console.log(`Found user ID: ${userId}`);
  }

  // Check existing moderators
  const { count, error: countErr } = await supabase
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .in("role", ["moderator", "admin"]);

  if (countErr) {
    console.error("Database query error:", countErr.message);
    process.exit(1);
  }

  console.log(`Current moderators/admins in database: ${count ?? 0}`);

  // Upsert admin and moderator roles
  const roles = [
    { user_id: userId, role: "admin" },
    { user_id: userId, role: "moderator" },
  ];

  const { error: upsertErr } = await supabase.from("user_roles").upsert(roles, {
    onConflict: "user_id,role",
  });

  if (upsertErr) {
    console.error("Failed to assign roles:", upsertErr.message);
    process.exit(1);
  }

  // Audit log
  await supabase.from("moderation_actions").insert({
    moderator_id: userId,
    action: "bootstrap_cli_moderator",
    reason: `Initial admin/moderator assigned via CLI script for ${target}`,
  });

  console.log(`Successfully assigned "admin" and "moderator" roles to user ${userId} (${target})!`);
  console.log("They can now access the /moderation dashboard.");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
