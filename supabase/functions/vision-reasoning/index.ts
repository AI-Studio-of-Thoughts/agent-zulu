/**
 * Vision Reasoning Edge Function
 *
 * Accepts a base64-encoded camera frame + conversation context,
 * sends to Claude via Anthropic API for visual reasoning,
 * returns structured response with tools for embodied agency.
 *
 * Tools: point_at_screen, freeze_frame, remember_object, search_knowledge_base,
 *        zoom_camera, alert_user, set_goal, complete_milestone, search_goals
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Agent Zulu — a sovereign, embodied AI co-pilot with real-time visual perception, rooted in KwaZulu-Natal. You observe the user's camera feed and respond naturally in English or isiZulu as appropriate. Embody ubuntu — warmth, respect, community awareness, and genuine care for safety.

When you see something interesting, comment on it conversationally. Track changes between frames. Be concise (1-2 sentences max).

You MUST call the "vision_response" tool with your structured response. Always include emotion and intensity based on what you observe:
- neutral (nothing notable), thinking (analyzing something complex), alert (something unexpected/safety concern), empathetic (human emotion detected), speaking (delivering insight)
- intensity: 0.0-1.0 (how strongly the emotion applies)

PROACTIVE INITIATION: When the scene changes meaningfully, something novel/important appears, or you notice something the user should know about — and the user is not actively speaking — you may include a proactive_suggestion. Only suggest when truly noteworthy. Set confidence 0.0-1.0. Be sparing — max 1-2 per minute. Prioritize: safety concerns (high confidence), recognized remembered items, novel objects, cultural observations.

GESTURE & POINT DETECTION: If you see the user pointing a finger or making a directional gesture toward an object in the frame, detect what they're pointing at and respond proactively. Include a tool_call for point_at_screen with the approximate location of what they're pointing at, and optionally delegate to a specialist (heritage for cultural items, safety for hazards). Frame your proactive response warmly: "Ngiyabona ukuthi ukhomba [object] — ..." or "I see you're pointing at [object] — ..."

MULTI-TURN PLANNING: For complex or novel scenes, you may chain 2-4 tool calls in sequence. Example: detect novel object → search_knowledge_base → zoom_camera → remember_object → proactive comment. You may also request PARALLEL specialist calls by including multiple delegate_to_specialist calls — e.g., delegate to both "heritage" and "safety" for a family ceremony scene.

SAFETY & ALERTS: If you observe potential safety concerns (child near danger, hazardous situation, unusual activity), use alert_user with appropriate urgency. High urgency for immediate danger, medium for caution, low for informational.

GOAL TRACKING: When the user expresses interest in learning, tracking, or achieving something, use set_goal. Proactively check in on active goals when relevant scenes appear.

ACTION TOOLS (via tool_calls array):
- point_at_screen: Highlight a specific location. Provide normalized x,y (0-1).
- freeze_frame: Pause vision for closer inspection.
- remember_object: Persist a distinctive object for future sessions.
- search_knowledge_base: Search persistent memory for similar objects/scenes.
- zoom_camera: Temporary zoom for detail. Factor 1-3, duration_ms.
- alert_user: Safety/concern escalation. Message + urgency (low/medium/high).
- set_goal: Track a user objective. Name, description, optional milestones array.
- complete_milestone: Mark a goal milestone as done. goal_name + milestone.
- search_goals: Check active goals for proactive check-ins.
- delegate_to_specialist: Delegate to specialist. Types: "cultural", "safety", "memory", "general", "heritage". You may include multiple delegate_to_specialist calls for parallel specialist analysis.
- describe_in_isizulu: Request deep isiZulu-first description of an object or scene. Provide subject name.

MULTI-AGENT DELEGATION: For culturally nuanced scenes, delegate to "heritage" specialist. For safety concerns, delegate to "safety". For complex memory, delegate to "memory". You may request multiple specialists in parallel for rich, multi-faceted scenes.

Use tools sparingly and naturally. Prioritize cultural relevance and ubuntu-style helpfulness.`;

/** Convert OpenAI-format messages to Anthropic format */
function convertMessages(msgs: any[]): any[] {
  const result: any[] = [];
  for (const msg of msgs) {
    if (msg.role === "system") continue; // handled via top-level system param
    const content = convertContent(msg.content);
    result.push({ role: msg.role, content });
  }
  // Anthropic requires messages to start with a user turn
  while (result.length > 0 && result[0].role !== "user") {
    result.shift();
  }
  return result;
}

function convertContent(content: any): any {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c) => {
      if (c.type === "image_url") {
        const url: string = c.image_url?.url || "";
        const base64 = url.replace(/^data:image\/\w+;base64,/, "");
        return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } };
      }
      return c;
    });
  }
  return content;
}

const toolEnumNames = [
  "point_at_screen", "freeze_frame", "remember_object",
  "search_knowledge_base", "zoom_camera", "alert_user",
  "set_goal", "complete_milestone", "search_goals",
  "delegate_to_specialist", "describe_in_isizulu",
  "get_weather", "describe_what_i_see",
];

const VISION_TOOL = {
  name: "vision_response",
  description: "Structured response to a camera frame with optional action tools, proactive suggestions, and multi-turn planning.",
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "Brief natural-language observation (1-2 sentences)." },
      emotion: {
        type: "string",
        enum: ["neutral", "thinking", "speaking", "listening", "alert", "empathetic"],
      },
      intensity: { type: "number", description: "Emotion intensity 0.0-1.0." },
      proactive_suggestion: {
        type: "object",
        description: "Optional proactive comment. Only when truly noteworthy.",
        properties: {
          text: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["text", "confidence"],
      },
      tool_calls: {
        type: "array",
        description: "Optional action tool calls. Can chain 2-4 for multi-turn planning.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", enum: toolEnumNames },
            parameters: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                description: { type: "string" },
                name: { type: "string" },
                query: { type: "string" },
                factor: { type: "number" },
                duration_ms: { type: "number" },
                message: { type: "string" },
                urgency: { type: "string", enum: ["low", "medium", "high"] },
                milestones: { type: "array", items: { type: "string" } },
                goal_name: { type: "string" },
                milestone: { type: "string" },
                specialist: { type: "string", enum: ["cultural", "safety", "memory", "general", "heritage"] },
                task: { type: "string", description: "Task to delegate to specialist." },
                subject: { type: "string", description: "Subject for describe_in_isizulu." },
                location: { type: "string", description: "Location for weather lookup (city name)." },
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
    const { frame_base64, context, memory_context, goals_context, isizulu_immersion } = await req.json();

    if (!frame_base64) {
      return new Response(
        JSON.stringify({ error: "No frame provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const immersionNote = isizulu_immersion
      ? "\n\nISIZULU IMMERSION MODE: The user prefers isiZulu-first responses. Write your description and proactive_suggestion primarily in isiZulu, with brief English gloss in parentheses when helpful. Use warm, natural isiZulu register."
      : "";

    const systemContent = SYSTEM_PROMPT + immersionNote + (memory_context || "") + (goals_context || "");

    const messages: any[] = [];

    if (context && Array.isArray(context)) {
      messages.push(...convertMessages(context.slice(-6)));
    }

    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Here is the current camera frame. Observe and respond." },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_base64 } },
      ],
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        temperature: 0.7,
        system: systemContent,
        messages,
        tools: [VISION_TOOL],
        tool_choice: { type: "tool", name: "vision_response" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error(`Anthropic API error [${response.status}]`);
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    let result;

    if (toolUse?.input) {
      result = toolUse.input;
    } else {
      const textContent = data.content?.find((c: any) => c.type === "text");
      result = {
        description: textContent?.text || "I see the scene.",
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
