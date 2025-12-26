import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { item_id, text, table } = await req.json();
    
    if (!item_id || !text) {
      console.log("Missing required fields:", { item_id, text });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing spellcheck for item ${item_id}: "${text}"`);

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
      // Update the item in the database
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const targetTable = table || "daily_check_template_items";
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
