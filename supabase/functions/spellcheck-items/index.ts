import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getSecureHeaders, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

// Allowed tables whitelist
const ALLOWED_TABLES = ["daily_check_template_items", "check_library_items"];

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Check if IP is blocked
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      console.log(`Blocked IP ${clientIp} attempted to access spellcheck-items`);
      return createBlockedIpResponse(blockResult, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.log("Authentication failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting - AI operations get moderate limits
    const rateLimitKey = getClientIdentifier(req, "spellcheck-items", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "expensive");
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { item_id, text, table } = await req.json();
    
    if (!item_id || !text) {
      console.log("Missing required fields:", { item_id, text });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetTable = table || "daily_check_template_items";
    
    // Validate table is in whitelist
    if (!ALLOWED_TABLES.includes(targetTable)) {
      console.log("Invalid table specified:", targetTable);
      return new Response(JSON.stringify({ error: "Invalid table specified" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership based on the target table
    if (targetTable === "daily_check_template_items") {
      // Get the item and verify ownership through template
      const { data: item, error: itemError } = await supabase
        .from("daily_check_template_items")
        .select("id, template_id, daily_check_templates!inner(user_id)")
        .eq("id", item_id)
        .single();

      if (itemError || !item) {
        console.log("Item not found:", item_id);
        return new Response(JSON.stringify({ error: "Item not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // @ts-ignore - Supabase types don't handle nested selects perfectly
      if (item.daily_check_templates?.user_id !== user.id) {
        console.log("User does not own this item:", { user_id: user.id, item_owner: item.daily_check_templates?.user_id });
        return new Response(JSON.stringify({ error: "Forbidden: Item does not belong to user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (targetTable === "check_library_items") {
      // check_library_items are global/admin items - only admins can modify
      const { data: isAdmin } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' 
      });

      if (!isAdmin) {
        console.log("User is not admin, cannot modify check_library_items");
        return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing spellcheck for item ${item_id}: "${text}" (user: ${user.id})`);

    // Call AI to spell-check and clean up the text
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a spell-checker for safety check items in an amusement ride inspection app. 
Your task is to correct spelling and grammar errors while preserving the original meaning.
Keep the text concise and professional - these are checklist items.
Only return the corrected text, nothing else. No explanations, no quotes.
If the text is already correct, return it unchanged.
Examples:
- "check breaks are working" -> "Check brakes are working"
- "electrickle wires safe" -> "Electrical wires safe"
- "saftey harness secure" -> "Safety harness secure"
- "oil levles ok" -> "Oil levels OK"`
          },
          {
            role: "user",
            content: text
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const correctedText = aiData.choices?.[0]?.message?.content?.trim();

    if (!correctedText) {
      console.log("No correction returned from AI");
      return new Response(JSON.stringify({ original: text, corrected: text, updated: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Correction result: "${text}" -> "${correctedText}"`);

    // Only update if there's a meaningful change
    if (correctedText.toLowerCase() !== text.toLowerCase() && correctedText.length > 0) {
      const column = targetTable === "daily_check_template_items" ? "check_item_text" : "label";

      const { error: updateError } = await supabase
        .from(targetTable)
        .update({ [column]: correctedText })
        .eq("id", item_id);

      if (updateError) {
        console.error("Database update error:", updateError);
        // Don't fail - the spell check still worked, just couldn't save
        return new Response(JSON.stringify({ 
          original: text, 
          corrected: correctedText, 
          updated: false,
          error: "Could not save correction"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Successfully updated item ${item_id}`);
      return new Response(JSON.stringify({ 
        original: text, 
        corrected: correctedText, 
        updated: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      original: text, 
      corrected: correctedText, 
      updated: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Spellcheck error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
