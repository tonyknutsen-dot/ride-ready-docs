import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Unified categories — must match src/constants/checkLibrary.ts
const CATEGORIES = [
  "Anchorage", "Blower", "Compliance", "Control Systems", "Electrical",
  "Fuel", "Gas", "General", "Hydraulic/Pneumatic", "Hygiene", "Mechanical",
  "Operations", "Restraints", "Safety", "Safety Devices", "Signage",
  "Site", "Storage", "Structure", "Weather"
];

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pending submissions without a similarity group (capped at 50)
    const { data: submissions, error: fetchError } = await supabase
      .from("user_submitted_check_items")
      .select("id, label, frequency, ride_category_id, category")
      .eq("status", "pending")
      .is("similarity_group", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!submissions || submissions.length === 0) {
      return new Response(JSON.stringify({ message: "No ungrouped submissions found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalPending = submissions.length;
    console.log(`Processing ${totalPending} submissions (max 50 per batch)`);

    // Fetch existing library items to learn from
    const { data: existingItems } = await supabase
      .from("check_library_items")
      .select("label, category, ride_category_id")
      .eq("is_active", true);

    const existingExamples = existingItems?.slice(0, 50).map(i => 
      `"${i.label}" -> ${i.category || 'General'}`
    ).join("\n") || "";

    if (!lovableApiKey) {
      console.log("No LOVABLE_API_KEY, using simple text matching");
      
      // Simple grouping fallback
      const groups: Map<string, string[]> = new Map();
      
      for (const sub of submissions) {
        const normalized = sub.label
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        
        let foundGroup: string | null = null;
        for (const [key, ids] of groups) {
          if (key.includes(normalized) || normalized.includes(key) || 
              levenshteinSimilarity(key, normalized) > 0.7) {
            foundGroup = key;
            break;
          }
        }
        
        if (foundGroup) {
          groups.get(foundGroup)!.push(sub.id);
        } else {
          groups.set(normalized, [sub.id]);
        }
      }

      let groupCount = 0;
      for (const [, ids] of groups) {
        if (ids.length > 1) {
          groupCount++;
          const groupId = crypto.randomUUID();
          for (const id of ids) {
            await supabase
              .from("user_submitted_check_items")
              .update({ similarity_group: groupId })
              .eq("id", id);
          }
        }
      }

      return new Response(JSON.stringify({ 
        message: `Grouped ${groupCount} sets of similar items (no AI)`,
        groups: groupCount
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch ride categories for context
    const { data: rideCategories } = await supabase
      .from("ride_categories")
      .select("id, name, category_group")
      .order("name");

    const rideCategoryList = rideCategories?.map(c => `- ${c.name} (${c.id})`).join("\n") || "";

    // Use Lovable AI for smart grouping, categorization, placement suggestions, AND spell-check
    const prompt = `You are analyzing safety check items submitted by fairground operators.

TASK 1: Group semantically similar items (items that mean the same thing).
TASK 2: Assign each item to the most appropriate technical category.
TASK 3: Determine if each item is GENERIC (applies to all equipment) or SPECIFIC to a ride type.
TASK 4: Fix any spelling or grammar errors in the labels.

TECHNICAL CATEGORIES (choose one for each item):
${CATEGORIES.map(c => `- ${c}`).join("\n")}

RIDE TYPES (use ID if item is specific to a ride type):
${rideCategoryList}

LEARN FROM EXISTING LIBRARY ITEMS:
${existingExamples}

ITEMS TO ANALYZE (note: some include the ride category they were submitted from):
${submissions.map((s, i) => `${i + 1}. "${s.label}" (freq: ${s.frequency}${s.ride_category_id ? `, from ride category: ${s.ride_category_id}` : ''})`).join("\n")}

Respond with JSON only:
{
  "groups": [[1, 5, 8], [2, 3]],
  "categories": {"1": "Restraints", "2": "Electrical"},
  "placement": {"1": "generic", "2": "specific", "3": "generic"},
  "ride_category_ids": {"2": "uuid-of-ride-category"},
  "corrected_labels": {"1": "Corrected label text", "3": "Another corrected label"}
}

Rules:
- Only group items that are truly similar in meaning
- Single items don't need a group
- Every item needs a category AND placement assignment
- "generic" = applies to ALL equipment types (e.g., "Fire extinguisher present", "Emergency stop accessible")
- "specific" = only relevant to certain ride types (e.g., "Harness locks engaged" for thrill rides, "Carousel pole secure" for carousels)
- If specific, include the ride_category_id it should apply to
- Learn from existing items to stay consistent
- ONLY include corrected_labels for items that have spelling/grammar errors - use proper British English
- Keep technical terms and abbreviations intact (e.g., "NDT", "RCD", "LOLER")`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error("Failed to call Lovable AI");
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "{}";
    
    let parsed: { 
      groups?: number[][], 
      categories?: Record<string, string>,
      placement?: Record<string, string>,
      ride_category_ids?: Record<string, string>,
      corrected_labels?: Record<string, string>
    } = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", content);
    }
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", content);
    }

    // Apply groupings
    let groupCount = 0;
    const groups = parsed.groups || [];
    for (const group of groups) {
      if (group.length > 1) {
        groupCount++;
        const groupId = crypto.randomUUID();
        for (const idx of group) {
          const submission = submissions[idx - 1];
          if (submission) {
            await supabase
              .from("user_submitted_check_items")
              .update({ similarity_group: groupId })
              .eq("id", submission.id);
          }
        }
      }
    }

    // Apply categories, placement suggestions, and spell corrections
    const categories = parsed.categories || {};
    const placement = parsed.placement || {};
    const rideCategoryIds = parsed.ride_category_ids || {};
    const correctedLabels = parsed.corrected_labels || {};
    let categorizedCount = 0;
    let spellCorrectedCount = 0;
    
    for (const [idx, category] of Object.entries(categories)) {
      const submission = submissions[parseInt(idx) - 1];
      if (submission && CATEGORIES.includes(category)) {
        const isGeneric = placement[idx] === "generic";
        const suggestedRideCategoryId = rideCategoryIds[idx] || null;
        const correctedLabel = correctedLabels[idx];
        
        const updateData: Record<string, any> = { 
          category,
          is_generic: isGeneric,
        };
        
        // Only set ride_category_id if AI suggests specific and provides an ID
        if (suggestedRideCategoryId && !isGeneric) {
          updateData.ride_category_id = suggestedRideCategoryId;
        }
        
        // Apply spell correction if provided
        if (correctedLabel && correctedLabel !== submission.label) {
          updateData.label = correctedLabel;
          spellCorrectedCount++;
        }
        
        await supabase
          .from("user_submitted_check_items")
          .update(updateData)
          .eq("id", submission.id);
        categorizedCount++;
      }
    }

    console.log(`Created ${groupCount} similarity groups, categorized ${categorizedCount} items, corrected ${spellCorrectedCount} spellings`);

    return new Response(JSON.stringify({ 
      message: `AI grouped ${groupCount} sets, categorized ${categorizedCount} items, corrected ${spellCorrectedCount} spellings`,
      groups: groupCount,
      categorized: categorizedCount,
      spellCorrected: spellCorrectedCount,
      processed: totalPending,
      note: totalPending === 50 ? "More items pending - run again to process next batch" : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in group-similar-check-items:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Simple Levenshtein distance similarity
function levenshteinSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1.0;
  
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}
