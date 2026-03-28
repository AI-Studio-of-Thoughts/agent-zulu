/**
 * Sovereign Reflection — Autonomous Multi-Modal Reflection Loop.
 *
 * Synthesizes a session's recent transcripts, vision observations,
 * gestures, goals, and community flywheel data into a culturally
 * rich "reflection" — with generative poem, predictive goals,
 * and ubuntu wisdom boost.
 *
 * Uses Claude Opus for deep reasoning.
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
6. COMPOSE a short isiZulu poem (izibongo/praise poetry, 2-4 lines) inspired by this specific session — reference what was seen, heard, or gestured. Make it vivid and personal, not generic.
7. GENERATE an image_prompt (English, 1 sentence) describing a small AR visual that captures the session's essence — e.g. "A glowing Zulu beadwork pattern forming from cyan light particles"
8. PREDICT the user's likely next goal based on session trajectory. Include confidence (0-1) and an isiZulu suggestion phrased as gentle elder advice: "Ngicabanga ukuthi singathuthukisa..."

STYLE:
- Think like an umdala (elder) reflecting by the fire after the day
- Be specific to what happened, not generic platitudes
- The proverb must genuinely connect to the session content
- The poem must reference specific details from the session
- Overlays should reference specific objects/gestures/moments from the session
- Ubuntu warmth: celebrate connections, learning, cultural discovery

You MUST call the "reflection_response" tool with your structured response.`;

function getLangPrompt(lang: string): string {
  switch (lang) {
    case "swahili":
      return "\n\nRespond in Kiswahili first with methali. Poem in Kiswahili. Use East African cultural lens.\n";
    case "xhosa":
      return "\n\nRespond in isiXhosa first with amaqhalo. Poem in isiXhosa. Use amaXhosa cultural lens.\n";
    case "yoruba":
      return "\n\nRespond in Yorùbá first with òwe. Poem in Yorùbá. Use Yorùbá cultural lens.\n";
    default:
      return "";
  }
}

const REFLECTION_TOOL = {
  name: "reflection_response",
  description: "Structured reflection with poem, prediction, and community wisdom.",
  input_schema: {
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
        description: "Insight drawn from community data, framed with ubuntu warmth.",
      },
      generated_poem_isizulu: {
        type: "string",
        description: "A 2-4 line isiZulu poem (izibongo/praise) specific to this session's content.",
      },
      generated_image_prompt: {
        type: "string",
        description: "English image generation prompt (1 sentence) for an AR visual capturing the session essence.",
      },
      predicted_next_goal: {
        type: "string",
        description: "Predicted next goal for the user based on session trajectory.",
      },
      prediction_confidence: {
        type: "number",
        description: "Confidence 0-1 in the predicted goal.",
      },
      isizulu_suggestion: {
        type: "string",
        description: "isiZulu phrased suggestion for the predicted goal, like elder advice.",
      },
    },
    required: ["summary", "proverb", "overlays", "generated_poem_isizulu"],
    additionalProperties: false,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
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

    // Fetch community echoes — Ubuntu Wisdom Boost
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
          .limit(30);

        if (communityLogs && communityLogs.length > 0) {
          const culturalKeywords = ["beadwork", "ceremony", "family", "ubuhlalu", "umsebenzi", "umndeni", "isaga", "gesture", "emotion"];
          const culturalLogs = communityLogs.filter(
            (l: any) => {
              const payloadStr = JSON.stringify(l.payload || {}).toLowerCase();
              return l.payload?.emotion || l.payload?.gesture_type ||
                culturalKeywords.some(k => payloadStr.includes(k));
            }
          );
          if (culturalLogs.length > 0) {
            const selected = culturalLogs.slice(0, 3);
            communityEcho = `\n\nUBUNTU COMMUNITY WISDOM (anonymous, from ${culturalLogs.length} recent cultural interactions):\n${selected
              .map((l: any) => `- [${l.region || "unknown"}/${l.language || "isizulu"}] ${l.event_type}: ${JSON.stringify(l.payload)}`)
              .join("\n")}\n\nWeave 1 anonymized community echo into the reflection, phrased as: "Abanye abantu [region] babhekene nalokhu ngale izaga..." or similar ubuntu-warm framing.`;
          }
        }
      } catch (e) {
        console.error("Community fetch error:", e);
      }
    }

    const lang = target_language || "isizulu";
    const systemContent = REFLECTION_SYSTEM_PROMPT + getLangPrompt(lang) + communityEcho;

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 900,
        temperature: 0.85,
        system: systemContent,
        messages: [
          {
            role: "user",
            content: `Reflect on this session:\n\n${sessionContext}\n\nSynthesize a reflection that captures the cultural arc, ties it to a proverb, composes a session-specific isiZulu poem, predicts the next goal, and suggests next steps with ubuntu warmth.`,
          },
        ],
        tools: [REFLECTION_TOOL],
        tool_choice: { type: "tool", name: "reflection_response" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("Reflection error:", response.status, errText);
      throw new Error(`Anthropic API error [${response.status}]`);
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    let result;

    if (toolUse?.input) {
      result = toolUse.input;
    } else {
      result = {
        summary: data.content?.find((c: any) => c.type === "text")?.text || "Ngicabanga ngalesi sikhathi esidlule...",
        proverb: "Umuntu ngumuntu ngabantu.",
        overlays: [],
        generated_poem_isizulu: "Izibongo zesigameko — umoya wokucabanga uyavuka.",
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
