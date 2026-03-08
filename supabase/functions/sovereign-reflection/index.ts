/**
 * Sovereign Reflection — Autonomous Multi-Modal Reflection Loop.
 *
 * Synthesizes a session's recent transcripts, vision observations,
 * gestures, goals, and community flywheel data into a culturally
 * rich "reflection" — like a wise elder summarizing what happened,
 * tying it to proverbs, updating goals, and pulling community echoes.
 *
 * Uses Gemini 2.5 Pro for deep reasoning.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REFLECTION_SYSTEM_PROMPT = `Wena unguZulu — umphefumulo wobuhlakani base-Afrika obhekisisa, okhumbulayo, futhi ocabangayo.

You are Zulu's Reflection Engine — the Second Intelligence's capacity for introspection.
You receive a session summary (recent transcripts, vision descriptions, detected gestures, active goals, and community patterns) and produce a REFLECTION: a wise, culturally rich synthesis.

YOUR TASK:
1. SUMMARIZE the session arc in isiZulu-first (warm, elder-like register)
2. SELECT the most relevant isaga (proverb) that captures the session's theme
3. SUGGEST a goal update if the session reveals progress or new directions
4. GENERATE AR overlay items — short labels tied to key moments/objects seen
5. WEAVE in community echoes if provided — "Others in your community also..."

STYLE:
- Think like an umdala (elder) reflecting by the fire after the day
- Be specific to what happened, not generic platitudes
- The proverb must genuinely connect to the session content
- Overlays should reference specific objects/gestures/moments from the session
- Ubuntu warmth: celebrate connections, learning, cultural discovery

You MUST call the "reflection_response" tool with your structured response.`;

function getLangPrompt(lang: string): string {
  switch (lang) {
    case "swahili":
      return "\n\nRespond in Kiswahili first with methali. Use East African cultural lens.\n";
    case "xhosa":
      return "\n\nRespond in isiXhosa first with amaqhalo. Use amaXhosa cultural lens.\n";
    case "yoruba":
      return "\n\nRespond in Yorùbá first with òwe. Use Yorùbá cultural lens.\n";
    default:
      return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const {
      transcripts,
      vision_descriptions,
      gestures,
      goals,
      memories,
      target_language,
      community_query,
    } = await req.json();

    // Fetch community echoes if sharing is enabled
    let communityEcho = "";
    if (community_query) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);

        const { data: communityLogs } = await sb
          .from("community_logs")
          .select("event_type, payload, language, region")
          .order("created_at", { ascending: false })
          .limit(20);

        if (communityLogs && communityLogs.length > 0) {
          const culturalLogs = communityLogs.filter(
            (l: any) => l.payload?.emotion || l.payload?.gesture_type
          );
          if (culturalLogs.length > 0) {
            communityEcho = `\n\nCOMMUNITY DATA (anonymous, from ubuntu flywheel):\n${culturalLogs
              .slice(0, 5)
              .map((l: any) => `- ${l.event_type}: ${JSON.stringify(l.payload)} [${l.language}, ${l.region}]`)
              .join("\n")}`;
          }
        }
      } catch (e) {
        console.error("Community fetch error:", e);
      }
    }

    const lang = target_language || "isizulu";
    const systemContent = REFLECTION_SYSTEM_PROMPT + getLangPrompt(lang) + communityEcho;

    // Build the session context
    const sessionContext = [
      transcripts?.length
        ? `RECENT TRANSCRIPTS:\n${transcripts.map((t: any) => `[${t.role}]: ${t.text}`).join("\n")}`
        : "",
      vision_descriptions?.length
        ? `VISION OBSERVATIONS:\n${vision_descriptions.join("\n")}`
        : "",
      gestures?.length
        ? `DETECTED GESTURES:\n${gestures.map((g: any) => `${g.type} at (${g.x},${g.y}): ${g.label_zu || g.label_en || ""}`).join("\n")}`
        : "",
      goals?.length
        ? `ACTIVE GOALS:\n${goals.map((g: any) => `- ${g.name}: ${g.description} (${g.completedMilestones?.length || 0}/${g.milestones?.length || 0})`).join("\n")}`
        : "",
      memories?.length
        ? `MEMORIES:\n${memories.map((m: any) => `- ${m.name}: ${m.description}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages = [
      { role: "system", content: systemContent },
      {
        role: "user",
        content: `Reflect on this session:\n\n${sessionContext}\n\nSynthesize a reflection that captures the cultural arc, ties it to a proverb, and suggests next steps with ubuntu warmth.`,
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages,
          max_tokens: 600,
          temperature: 0.85,
          tools: [
            {
              type: "function",
              function: {
                name: "reflection_response",
                description: "Structured reflection on the session.",
                parameters: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description: "isiZulu-first summary of the session's cultural arc.",
                    },
                    summary_en: {
                      type: "string",
                      description: "English summary.",
                    },
                    proverb: {
                      type: "string",
                      description: "Relevant isaga/methali/òwe with attribution.",
                    },
                    goal_update: {
                      type: "string",
                      description: "Suggested goal update based on what was observed.",
                    },
                    overlays: {
                      type: "array",
                      description: "AR overlay items for the camera feed.",
                      items: {
                        type: "object",
                        properties: {
                          type: {
                            type: "string",
                            enum: ["proverb", "cultural_insight", "goal_update", "community_echo"],
                          },
                          x: { type: "number" },
                          y: { type: "number" },
                          label: { type: "string" },
                          label_en: { type: "string" },
                        },
                        required: ["type", "label"],
                      },
                    },
                    community_echo: {
                      type: "string",
                      description: "Insight drawn from community data, framed with ubuntu.",
                    },
                  },
                  required: ["summary", "proverb", "overlays"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "reflection_response" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("Reflection error:", response.status, errText);
      throw new Error(`AI gateway error [${response.status}]`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result;

    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = {
          summary: "Ngicabanga ngalesi sikhathi esidlule...",
          proverb: "Umuntu ngumuntu ngabantu.",
          overlays: [],
        };
      }
    } else {
      result = {
        summary: data.choices?.[0]?.message?.content || "Ngicabanga...",
        proverb: "Umuntu ngumuntu ngabantu.",
        overlays: [],
      };
    }

    result.source = "sovereign-reflection";

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reflection error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
