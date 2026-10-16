import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { looksIdentifying } from "@/lib/herway";

export type ApproveReportInput = {
  reportId: string;
  areaLabel: string;
  summary: string;
  reason: string;
};

/**
 * Server-side atomic report approval.
 * Evaluates identifying text, enforces moderator role, computes jittered/rounded
 * coordinates server-side from the private report, creates the published incident,
 * updates the incident report status, and logs to moderation audit in a single transaction.
 */
export const approveReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: ApproveReportInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.reportId) throw new Error("Report ID is required");
    if (!data.areaLabel || data.areaLabel.trim().length < 3) {
      throw new Error("A general area name of at least 3 characters is required");
    }
    if (!data.reason || data.reason.trim().length < 3) {
      throw new Error("A reason of at least 3 characters is required for the audit log");
    }
    if (looksIdentifying(data.summary)) {
      throw new Error("The public summary appears to contain contact details. Please remove them.");
    }

    // Call the atomic database function
    const { data: result, error } = await supabase.rpc("approve_and_publish_report", {
      _report_id: data.reportId,
      _area_label: data.areaLabel.trim(),
      _summary: data.summary.trim() || null,
      _reason: data.reason.trim(),
    });

    if (error) {
      console.error("[Moderation] approve_and_publish_report RPC failed:", error);
      throw new Error(error.message || "Failed to approve report on the server");
    }

    return result as { published_id: string; lat: number; lng: number; status: string };
  });

/**
 * Check if initial moderator bootstrap is available (i.e. zero moderators exist yet).
 */
export const checkCanBootstrapFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .in("role", ["moderator", "admin"]);

    if (error) {
      console.error("[Bootstrap] Failed to check moderator count:", error);
      return { canBootstrap: false };
    }

    return { canBootstrap: (count ?? 0) === 0 };
  } catch (err) {
    console.error("[Bootstrap] Error checking bootstrap availability:", err);
    return { canBootstrap: false };
  }
});

/**
 * Safe bootstrap for the first moderator.
 * Requires:
 * 1. User must be signed in.
 * 2. Exactly ZERO moderators or admins exist in the database (permanently locks once claimed).
 * 3. Token must match MODERATOR_BOOTSTRAP_TOKEN env var (or min length check if in local dev).
 */
export const bootstrapFirstModeratorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { secretToken: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const token = data.secretToken?.trim();

    if (!token || token.length < 8) {
      throw new Error("Bootstrap secret token must be at least 8 characters long");
    }

    const expectedSecret = process.env.MODERATOR_BOOTSTRAP_TOKEN?.trim();
    if (expectedSecret && token !== expectedSecret) {
      throw new Error("Invalid bootstrap secret token");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Double-check: ensure no moderators exist
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .in("role", ["moderator", "admin"]);

    if (countErr) {
      throw new Error("Database check failed: " + countErr.message);
    }

    if ((count ?? 0) > 0) {
      throw new Error("Moderator bootstrap is permanently locked: moderators already exist");
    }

    // Assign admin and moderator roles to the caller
    const rolesToAssign = [
      { user_id: userId, role: "admin" as const },
      { user_id: userId, role: "moderator" as const },
    ];

    const { error: insertErr } = await supabaseAdmin.from("user_roles").upsert(rolesToAssign, {
      onConflict: "user_id,role",
    });

    if (insertErr) {
      throw new Error("Failed to assign roles: " + insertErr.message);
    }

    // Append to audit trail
    await supabaseAdmin.from("moderation_actions").insert({
      moderator_id: userId,
      action: "bootstrap_first_moderator",
      reason: "Claimed initial admin and moderator role via secure bootstrap",
    });

    return { success: true, message: "Moderator role successfully claimed" };
  });

/**
 * Role assignment for subsequent moderators, restricted to admins.
 */
export const assignUserRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { targetUserId: string; role: "moderator" | "admin" }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if caller is admin
    const { data: adminCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminCheck) {
      throw new Error("Unauthorized: Only admins can assign roles");
    }

    const { error: upsertErr } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: data.targetUserId, role: data.role },
      { onConflict: "user_id,role" }
    );

    if (upsertErr) {
      throw new Error("Failed to assign role: " + upsertErr.message);
    }

    await supabaseAdmin.from("moderation_actions").insert({
      moderator_id: userId,
      action: "role_assigned",
      reason: `Assigned ${data.role} role to ${data.targetUserId}`,
    });

    return { success: true };
  });
