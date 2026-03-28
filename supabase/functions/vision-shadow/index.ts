/**
 * Vision Shadow Comparison Edge Function
 *
 * Sends the same camera frame to multiple Claude models in parallel,
 * returns all results for comparison logging. The primary model response
 * is handled by vision-reasoning — this function is fire-and-forget shadow only.
 *
 * Models compared:
 * - claude-haiku-4-5-20251001 (fast, baseline)
 * - claude-sonnet-4-6 (balanced)
 * - claude-opus-4-6 (premium, deep reasoning)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHADOW_SYSTEM_PROMPT = `You are Agent Zulu — a sovereign, embodied AI co-pilot rooted in KwaZulu-Natal. You observe a camera frame and respond naturally in English or isiZulu as appropriate. Embody ubuntu — warmth, respect, community awareness. Be concise (1-2 sentences max).

You MUST call the "vision_response" tool with your structured response.`;

const SHADOW_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
];

const TOOL_SCHEMA = {
  name: "vision_response",
  description: "Structured response to a camera frame.",
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "Brief observation (1-2 sentences)." },
      emotion: {
        type: "string",
        enum: ["neutral", "thinking", "speaking", "listening", "alert", "empathetic"],
      },
      intensity: { type: "number", description: "Emotion intensity 0.0-1.0." },
      isizulu_quality: {
        type: "string",
        description: "If isiZulu was used, self-rate quality: none, basic, fluent, proverbial",
        enum: ["none", "basic", "fluent", "proverbial"],
      },
      cultural_depth: {
        type: "number",
        description: "How culturally relevant/rich is the response 0.0-1.0",
      },
    },
    required: ["description", "emotion", "intensity"],
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
    const { frame_base64, isizulu_immersion, primary_result } = await req.json();

    if (!frame_base64) {
      return new Response(
        JSON.stringify({ error: "No frame provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const immersionNote = isizulu_immersion
      ? "\n\nISIZULU IMMERSION MODE: Respond primarily in isiZulu with brief English gloss."
      : "";

    const systemContent = SHADOW_SYSTEM_PROMPT + immersionNote;

    const userMessage = {
      role: "user",
      content: [
        { type: "text", text: "Observe this camera frame and respond." },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_base64 } },
      ],
    };

    // Fire all models in parallel
    const results = await Promise.allSettled(
      SHADOW_MODELS.map(async (model) => {
        const start = Date.now();
        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: 300,
              temperature: 0.7,
              system: systemContent,
              messages: [userMessage],
              tools: [TOOL_SCHEMA],
              tool_choice: { type: "tool", name: "vision_response" },
            }),
          });

          const latency = Date.now() - start;

          if (!response.ok) {
            const errText = await response.text();
            return { model, latency, error: `HTTP ${response.status}: ${errText.slice(0, 200)}` };
          }

          const data = await response.json();
          const toolUse = data.content?.find((c: any) => c.type === "tool_use");
          let parsed = null;

          if (toolUse?.input) {
            parsed = toolUse.input;
          } else {
            const textContent = data.content?.find((c: any) => c.type === "text");
            parsed = { description: textContent?.text || "Parse failed", emotion: "neutral", intensity: 0.3 };
          }

          return { model, latency, result: parsed };
        } catch (e) {
          return { model, latency: Date.now() - start, error: e instanceof Error ? e.message : "Unknown error" };
        }
      })
    );

    const comparison = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { model: SHADOW_MODELS[i], error: (r as PromiseRejectedResult).reason?.message || "Promise rejected" };
    });

    return new Response(
      JSON.stringify({
        primary_model: "claude-sonnet-4-6",
        primary_result: primary_result || null,
        shadow_results: comparison,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Vision shadow error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
