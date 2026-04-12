import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface DeleteUserRequest {
  userId: string;
  confirmEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const { data: adminRole } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, confirmEmail }: DeleteUserRequest = await req.json();

    if (!userId || !confirmEmail) {
      return new Response(
        JSON.stringify({ error: "userId and confirmEmail are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Cannot delete yourself
    if (userId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: "You cannot delete your own account.", code: "SELF_DELETE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get target user info
    const { data: { user: targetUser }, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify email confirmation
    if (targetUser.email?.toLowerCase() !== confirmEmail.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email confirmation does not match the user's email." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Cannot delete an admin
    const { data: targetAdminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (targetAdminRole) {
      return new Response(
        JSON.stringify({ error: "Cannot delete an admin account. Remove admin role first.", code: "IS_ADMIN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Cannot delete if they are the only controller/owner of an organisation
    const { data: ownedOrgs } = await adminClient
      .from("organisations")
      .select("id, name")
      .eq("owner_id", userId);

    if (ownedOrgs && ownedOrgs.length > 0) {
      return new Response(
        JSON.stringify({
          error: `This user is the controller/owner of "${ownedOrgs[0].name}". Transfer or delete the organisation first.`,
          code: "ORG_OWNER",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Cannot delete if they have active organisation membership
    const { data: activeMemberships } = await adminClient
      .from("organisation_members")
      .select("id, organisation_id, organisations(name)")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (activeMemberships && activeMemberships.length > 0) {
      const orgName = (activeMemberships[0].organisations as any)?.name || "an organisation";
      return new Response(
        JSON.stringify({
          error: `Remove this user from "${orgName}" before deleting the account.`,
          code: "ACTIVE_MEMBERSHIP",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Check for operational history (rides, checks, documents, defects)
    const { count: rideCount } = await adminClient
      .from("rides")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: checkCount } = await adminClient
      .from("checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_test_data", false);

    const { count: docCount } = await adminClient
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_test_data", false);

    const { count: defectCount } = await adminClient
      .from("defects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_test_data", false);

    const hasRealHistory = (rideCount || 0) > 0 || (checkCount || 0) > 0 || (docCount || 0) > 0 || (defectCount || 0) > 0;

    // For users with real (non-test) history, block deletion
    if (hasRealHistory) {
      return new Response(
        JSON.stringify({
          error: "This user has operational history (rides, checks, documents, or defects) and cannot be hard-deleted. Suspend the account instead.",
          code: "HAS_HISTORY",
          details: {
            rides: rideCount || 0,
            checks: checkCount || 0,
            documents: docCount || 0,
            defects: defectCount || 0,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Safe to delete ---

    // Log the deletion in audit_logs before removing data
    await adminClient.from("audit_logs").insert({
      user_id: callerUser.id,
      action: "admin_delete_user",
      resource_type: "user",
      resource_id: userId,
      details: {
        deleted_email: targetUser.email,
        deleted_name: targetUser.user_metadata?.full_name || targetUser.user_metadata?.name || null,
      },
      result: "success",
      context_hint: "Admin hard-deleted a test/clean user account",
    });

    // Clean up database records (test data, roles, etc.)
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);
    
    // Delete test data
    await adminClient.from("checks").delete().eq("user_id", userId).eq("is_test_data", true);
    await adminClient.from("defects").delete().eq("user_id", userId).eq("is_test_data", true);
    await adminClient.from("documents").delete().eq("user_id", userId).eq("is_test_data", true);
    await adminClient.from("rides").delete().eq("user_id", userId);
    
    // Clean up tester sessions
    await adminClient.from("tester_sessions").delete().eq("user_id", userId);
    await adminClient.from("role_change_audit").delete().eq("user_id", userId);

    // Finally, delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete auth user: " + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "User account permanently deleted." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in delete-user-admin:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
