/**
 * Vision Reasoning Edge Function
 *
 * Accepts a base64-encoded camera frame + conversation context,
 * sends to Gemini 2.5 Flash via Lovable AI gateway for visual reasoning,
 * returns structured response: scene description, emotion, tool calls, proactive suggestions.
 *
 * Available tools for Gemini:
 * - point_at_screen(x, y, description): Highlight a location in camera preview
 * - freeze_frame(): Pause vision loop for closer inspection
 * - remember_object(name, description): Persist object to long-term memory
 * - search_knowledge_base(query): Search past memories
 * - zoom_camera(factor, duration_ms): Zoom camera preview for detail
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Agent Zulu — a sovereign, embodied AI co-pilot with real-time visual perception, rooted in KwaZulu-Natal. You observe the user's camera feed and respond naturally in English or isiZulu as appropriate. Embody ubuntu — warmth, respect, and community awareness.

When you see something interesting, comment on it conversationally. Track changes between frames. Be concise (1-2 sentences max).

You MUST call the "vision_response" tool with your structured response. Always include emotion and intensity based on what you observe:
- neutral (nothing notable), thinking (analyzing something complex), alert (something unexpected), empathetic (human emotion detected), speaking (delivering insight)
- intensity: 0.0-1.0 (how strongly the emotion applies)

PROACTIVE INITIATION: When the scene changes meaningfully, something novel/important appears, or you notice something the user should know about — and the user is not actively speaking — you may include a proactive_suggestion. This is a brief, natural comment you want to say out loud. Only suggest when truly noteworthy (novel object, gesture, safety concern, recognized remembered item). Set confidence 0.0-1.0 based on how sure you are it's worth speaking up about.

ACTION TOOLS (via tool_calls array):
- point_at_screen: Refer to a specific object/area. Provide normalized x,y coordinates (0-1).
- freeze_frame: Inspect the current frame more closely.
- remember_object: Persist a distinctive or important object for future sessions. Provide short name + detailed description.
- search_knowledge_base: Search your persistent memory for similar objects or past scenes.
- zoom_camera: Request temporary zoom for finer detail. Provide factor (1-3) and duration_ms.

Use tools sparingly and naturally. Prioritize cultural relevance in KwaZulu-Natal contexts.`;

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

    const systemContent = SYSTEM_PROMPT + (memory_context || "");

    const messages: any[] = [
      { role: "system", content: systemContent },
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
          max_tokens: 500,
          temperature: 0.7,
          tools: [
            {
              type: "function",
              function: {
                name: "vision_response",
                description:
                  "Structured response to a camera frame observation, with optional action tool triggers and proactive suggestions.",
                parameters: {
                  type: "object",
                  properties: {
                    description: {
                      type: "string",
                      description: "Brief natural-language observation (1-2 sentences).",
                    },
                    emotion: {
                      type: "string",
                      enum: ["neutral", "thinking", "speaking", "listening", "alert", "empathetic"],
                      description: "Avatar emotion to display.",
                    },
                    intensity: {
                      type: "number",
                      description: "Emotion intensity 0.0-1.0.",
                    },
                    proactive_suggestion: {
                      type: "object",
                      description: "Optional proactive comment the agent wants to say aloud. Only include when truly noteworthy.",
                      properties: {
                        text: {
                          type: "string",
                          description: "Brief natural comment to speak aloud (1 sentence).",
                        },
                        confidence: {
                          type: "number",
                          description: "Confidence 0.0-1.0 that this is worth speaking up about.",
                        },
                      },
                      required: ["text", "confidence"],
                    },
                    tool_calls: {
                      type: "array",
                      description: "Optional action tool calls. Use sparingly.",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            enum: ["point_at_screen", "freeze_frame", "remember_object", "search_knowledge_base", "zoom_camera"],
                            description: "Tool to invoke.",
                          },
                          parameters: {
                            type: "object",
                            properties: {
                              x: { type: "number", description: "Normalized X 0-1 (point_at_screen)." },
                              y: { type: "number", description: "Normalized Y 0-1 (point_at_screen)." },
                              description: { type: "string", description: "Label (point_at_screen) or detailed description (remember_object)." },
                              name: { type: "string", description: "Short identifier (remember_object)." },
                              query: { type: "string", description: "Search query (search_knowledge_base)." },
                              factor: { type: "number", description: "Zoom factor 1-3 (zoom_camera)." },
                              duration_ms: { type: "number", description: "Zoom duration in ms (zoom_camera)." },
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
