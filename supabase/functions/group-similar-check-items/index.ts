import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Verify the user is an admin
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

    // Fetch all pending submissions
    const { data: submissions, error: fetchError } = await supabase
      .from("user_submitted_check_items")
      .select("id, label, frequency, ride_category_id")
      .eq("status", "pending")
      .is("similarity_group", null);

    if (fetchError) throw fetchError;

    if (!submissions || submissions.length === 0) {
      return new Response(JSON.stringify({ message: "No ungrouped submissions found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${submissions.length} submissions for similarity grouping`);

    // If we don't have Lovable API key, use simple text similarity
    if (!lovableApiKey) {
      console.log("No LOVABLE_API_KEY, using simple text matching");
      
      // Simple grouping by normalized text
      const groups: Map<string, string[]> = new Map();
      
      for (const sub of submissions) {
        // Normalize: lowercase, remove extra spaces, remove punctuation
        const normalized = sub.label
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        
        // Find existing group with similar text
        let foundGroup: string | null = null;
        for (const [key, ids] of groups) {
          // Check Levenshtein distance or simple includes
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

      // Update submissions with group IDs
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
        message: `Grouped ${groupCount} sets of similar items`,
        groups: groupCount
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI for smarter grouping
    const prompt = `You are analyzing check items submitted by users for safety inspection templates.
Group these items by semantic similarity - items that mean the same thing should be in the same group.

Items to analyze:
${submissions.map((s, i) => `${i + 1}. "${s.label}" (freq: ${s.frequency})`).join("\n")}

Respond with a JSON array of groups, where each group contains the item numbers (1-indexed) that are similar:
Example: [[1, 5, 8], [2, 3], [4, 6, 7]]

Only group items that are truly similar in meaning. Single items don't need a group.
Only output the JSON array, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/chat/completions", {
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
      console.error("AI API error:", await response.text());
      throw new Error("Failed to call AI API");
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "[]";
    
    // Parse the response
    let groups: number[][] = [];
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        groups = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      groups = [];
    }

    // Apply groupings
    let groupCount = 0;
    for (const group of groups) {
      if (group.length > 1) {
        groupCount++;
        const groupId = crypto.randomUUID();
        for (const idx of group) {
          const submission = submissions[idx - 1]; // 1-indexed
          if (submission) {
            await supabase
              .from("user_submitted_check_items")
              .update({ similarity_group: groupId })
              .eq("id", submission.id);
          }
        }
      }
    }

    console.log(`Created ${groupCount} similarity groups`);

    return new Response(JSON.stringify({ 
      message: `AI grouped ${groupCount} sets of similar items`,
      groups: groupCount
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
