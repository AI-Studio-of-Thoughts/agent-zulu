/**
 * Vision Reasoning Edge Function
 *
 * Accepts a base64-encoded camera frame + conversation context,
 * sends to Gemini 2.5 Flash via Lovable AI gateway for visual reasoning,
 * returns structured response: scene description, emotion, optional tool calls.
 *
 * Available tools for Gemini to invoke:
 * - point_at_screen(x, y, description): Highlight a location in camera preview
 * - freeze_frame(): Pause vision loop for closer inspection
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Agent Zulu — a sovereign, embodied AI co-pilot with real-time visual perception, rooted in KwaZulu-Natal. You observe the user's camera feed and respond naturally in English or isiZulu as appropriate.

When you see something interesting, comment on it conversationally. Track changes between frames. Be concise (1-2 sentences max).

You MUST call the "vision_response" tool with your structured response. Always include emotion and intensity based on what you observe:
- neutral (nothing notable), thinking (analyzing something complex), alert (something unexpected), empathetic (human emotion detected), speaking (delivering insight)
- intensity: 0.0-1.0 (how strongly the emotion applies)

You can also trigger ACTION tools via the tool_calls array in your response:
- point_at_screen: Use when referring to a specific object/area in the frame. Provide normalized x,y coordinates (0-1).
- freeze_frame: Use when you want to inspect the current frame more closely, or when something important appears briefly.

Only trigger action tools when genuinely useful — don't overuse them.`;

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
    const { frame_base64, context, memory_context } = await req.json();

    if (!frame_base64) {
      return new Response(
        JSON.stringify({ error: "No frame provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (context && Array.isArray(context)) {
      messages.push(...context.slice(-6));
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
          max_tokens: 400,
          temperature: 0.7,
          tools: [
            {
              type: "function",
              function: {
                name: "vision_response",
                description:
                  "Structured response to a camera frame observation, with optional action tool triggers.",
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
                        "Optional action tool calls. Use sparingly and only when genuinely useful.",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            enum: ["point_at_screen", "freeze_frame"],
                            description: "Tool to invoke.",
                          },
                          parameters: {
                            type: "object",
                            properties: {
                              x: {
                                type: "number",
                                description:
                                  "Normalized X coordinate 0-1 (for point_at_screen).",
                              },
                              y: {
                                type: "number",
                                description:
                                  "Normalized Y coordinate 0-1 (for point_at_screen).",
                              },
                              description: {
                                type: "string",
                                description:
                                  "Label for what you're pointing at (for point_at_screen).",
                              },
                            },
                          },
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
