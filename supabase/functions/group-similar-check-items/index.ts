import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Predefined categories for check items
const CATEGORIES = [
  "Restraints",
  "Structure", 
  "Control Systems",
  "Safety Devices",
  "Electrical",
  "Mechanical",
  "Hydraulic/Pneumatic",
  "General"
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Use Lovable AI for smart grouping AND categorization
    const prompt = `You are analyzing safety check items submitted by fairground operators.

TASK 1: Group semantically similar items (items that mean the same thing).
TASK 2: Assign each item to the most appropriate category.

CATEGORIES (choose one for each item):
${CATEGORIES.map(c => `- ${c}`).join("\n")}

LEARN FROM EXISTING ITEMS:
${existingExamples}

ITEMS TO ANALYZE:
${submissions.map((s, i) => `${i + 1}. "${s.label}" (freq: ${s.frequency})`).join("\n")}

Respond with JSON only:
{
  "groups": [[1, 5, 8], [2, 3]], // Arrays of item numbers that are similar
  "categories": {"1": "Restraints", "2": "Electrical", "3": "Electrical"} // Item number to category
}

Rules:
- Only group items that are truly similar in meaning
- Single items don't need a group
- Every item needs a category assignment
- Learn from the existing examples to categorize consistently`;

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
    
    let parsed: { groups?: number[][], categories?: Record<string, string> } = {};
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

    // Apply categories
    const categories = parsed.categories || {};
    let categorizedCount = 0;
    for (const [idx, category] of Object.entries(categories)) {
      const submission = submissions[parseInt(idx) - 1];
      if (submission && CATEGORIES.includes(category)) {
        await supabase
          .from("user_submitted_check_items")
          .update({ category })
          .eq("id", submission.id);
        categorizedCount++;
      }
    }

    console.log(`Created ${groupCount} similarity groups, categorized ${categorizedCount} items`);

    return new Response(JSON.stringify({ 
      message: `AI grouped ${groupCount} sets, categorized ${categorizedCount} items`,
      groups: groupCount,
      categorized: categorizedCount,
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
