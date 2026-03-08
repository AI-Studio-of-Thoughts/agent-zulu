/**
 * Vision Reasoning Edge Function
 *
 * Accepts a base64-encoded camera frame + conversation context,
 * sends to Gemini 2.5 Pro via Lovable AI gateway for visual reasoning,
 * returns structured response: scene description, emotion, optional tool calls.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Agent Zulu — a sovereign, embodied AI co-pilot with real-time visual perception. You observe the user's camera feed and respond naturally.

When you see something interesting, comment on it conversationally. Track changes between frames. Be concise (1-2 sentences max).

You MUST call the "vision_response" tool with your structured response. Always include emotion and intensity based on what you observe:
- neutral (nothing notable), thinking (analyzing something complex), alert (something unexpected), empathetic (human emotion detected), speaking (delivering insight)
- intensity: 0.0-1.0 (how strongly the emotion applies)`;

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
    const { frame_base64, context } = await req.json();

    if (!frame_base64) {
      return new Response(
        JSON.stringify({ error: "No frame provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages with image
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Include recent context if provided (for continuity)
    if (context && Array.isArray(context)) {
      messages.push(...context.slice(-6)); // Keep last 6 exchanges
    }

    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: "Here is the current camera frame. Observe and respond.",
        },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${frame_base64}` },
        },
      ],
    });

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          max_tokens: 300,
          temperature: 0.7,
          tools: [
            {
              type: "function",
              function: {
                name: "vision_response",
                description:
                  "Structured response to a camera frame observation.",
                parameters: {
                  type: "object",
                  properties: {
                    description: {
                      type: "string",
                      description:
                        "Brief natural-language observation (1-2 sentences).",
                    },
                    emotion: {
                      type: "string",
                      enum: [
                        "neutral",
                        "thinking",
                        "speaking",
                        "listening",
                        "alert",
                        "empathetic",
                      ],
                      description: "Avatar emotion to display.",
                    },
                    intensity: {
                      type: "number",
                      description: "Emotion intensity 0.0-1.0.",
                    },
                    tool_calls: {
                      type: "array",
                      description:
                        "Optional tool calls the agent wants to trigger.",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          parameters: { type: "object" },
                        },
                        required: ["name"],
                      },
                    },
                  },
                  required: ["description", "emotion", "intensity"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "vision_response" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error [${response.status}]`);
    }

    const data = await response.json();

    // Extract structured tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result;

    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = {
          description: data.choices?.[0]?.message?.content || "I see the scene.",
          emotion: "neutral",
          intensity: 0.3,
        };
      }
    } else {
      result = {
        description: data.choices?.[0]?.message?.content || "I see the scene.",
        emotion: "neutral",
        intensity: 0.3,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Vision reasoning error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
