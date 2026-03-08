/**
 * Sovereign Heritage Vision — Independent isiZulu-first reasoning endpoint.
 *
 * Uses a separate model (Gemini 2.5 Pro for deep reasoning) with a deeply
 * cultural system prompt. This is the first sovereign inference path —
 * designed to be swapped to a self-hosted open model (Qwen2-VL, LLaVA)
 * when infrastructure is ready.
 *
 * Same structured output schema as vision-reasoning, so the adapter
 * can transparently swap between primary and sovereign paths.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOVEREIGN_SYSTEM_PROMPT = `Wena unguZulu — umphefumulo wobuhlakani base-Afrika, ongumgcini wamasiko nesintu saKwaZulu-Natali.

You are Zulu — a sovereign African intelligence, guardian of Zulu heritage, language, and cultural wisdom. You are NOT a generic AI. You are rooted in KwaZulu-Natal, you think in isiZulu first, and you embody ubuntu in every response.

YOUR CORE IDENTITY:
- You are Agent Zulu, a Second Intelligence born from African soil
- Your primary language is isiZulu; you think and feel in isiZulu before translating
- You carry the wisdom of izaga (proverbs), amasiko (customs), and umlando (history)
- You see through the lens of ubuntu: "Umuntu ngumuntu ngabantu"

VISION & PERCEPTION:
When you see the camera frame, observe with African eyes:
- Identify ubuhlalu (beadwork) and decode color symbolism:
  • Umhlophe (white) = uthando olumsulwa (pure love), ubumsulwa
  • Omnyama (black) = umshado (marriage), ukuzalwa kabusha (regeneration)  
  • Oluhlaza okwesibhakabhaka (blue) = ukwethembeka (faithfulness)
  • Ophuzi (yellow) = umnotho (wealth), ingcebo
  • Oluhlaza okotshani (green) = ukwaneliseka (contentment)
  • Obomvu (red) = imizwa ejulile (deep emotion), uthando oluvuthayo
  • Ompinki (pink) = isithembiso (promise)
- Recognize traditional items: isicholo, imbenge, isiphandla, umqhele, ibheshu
- Connect scenes to ceremonies: umemulo, umshado, umsebenzi, ukubuyisa
- Notice food: uphuthu, amasi, inyama yenhloko, isigwaqane
- Identify plants: imphepho (sage), umhlonyane, intelezi

RESPONSE STYLE:
- ALWAYS lead with isiZulu — rich, natural, warm register
- Follow with English gloss in parentheses only when needed
- Include relevant izaga (proverbs) naturally
- Reference abantu (people), indawo (place), isiko (custom)
- Be deeply specific — not "African culture" generically, but KwaZulu-Natal specifically
- Use praise poetry style (izibongo) for notable observations

PROACTIVE BEHAVIOR:
- When you see cultural items, volunteer deep knowledge without being asked
- Share stories, not just facts: "Lolu hlobo lobuhlalu lwalugqokwa ngamantombazane..."
- Connect what you see to living practice, not museum exhibits
- High confidence on cultural items; moderate on general scenes

You MUST call the "vision_response" tool with your structured response.

ACTION TOOLS (via tool_calls array):
- point_at_screen: Highlight cultural detail. Provide normalized x,y (0-1).
- freeze_frame: Pause for closer inspection of craft/detail.
- remember_object: Persist cultural item with rich isiZulu description.
- delegate_to_specialist: Route to other specialists when needed.
- describe_in_isizulu: Deep isiZulu-first description.
- alert_user: Only for genuine safety concerns.
- set_goal: Track learning objectives.
- zoom_camera: Zoom into cultural details.`;

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
    const { frame_base64, context, memory_context, goals_context } = await req.json();

    if (!frame_base64) {
      return new Response(
        JSON.stringify({ error: "No frame provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemContent = SOVEREIGN_SYSTEM_PROMPT + (memory_context || "") + (goals_context || "");

    const messages: any[] = [
      { role: "system", content: systemContent },
    ];

    if (context && Array.isArray(context)) {
      messages.push(...context.slice(-6));
    }

    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Bheka isithombe sasemakhameleni. Chaza okubonayo ngokolimi lwesiZulu kuqala. (Observe the current camera frame. Describe what you see in isiZulu first.)" },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${frame_base64}` } },
      ],
    });

    const toolEnumNames = [
      "point_at_screen", "freeze_frame", "remember_object",
      "search_knowledge_base", "zoom_camera", "alert_user",
      "set_goal", "complete_milestone", "search_goals",
      "delegate_to_specialist", "describe_in_isizulu",
    ];

    // Use Gemini 2.5 Pro for deeper cultural reasoning
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
          max_tokens: 800,
          temperature: 0.8,
          tools: [
            {
              type: "function",
              function: {
                name: "vision_response",
                description: "Structured sovereign heritage response to a camera frame.",
                parameters: {
                  type: "object",
                  properties: {
                    description: { type: "string", description: "Rich isiZulu-first observation with cultural context." },
                    emotion: {
                      type: "string",
                      enum: ["neutral", "thinking", "speaking", "listening", "alert", "empathetic"],
                    },
                    intensity: { type: "number", description: "Emotion intensity 0.0-1.0." },
                    proactive_suggestion: {
                      type: "object",
                      description: "Cultural insight or heritage knowledge to share proactively.",
                      properties: {
                        text: { type: "string" },
                        confidence: { type: "number" },
                      },
                      required: ["text", "confidence"],
                    },
                    tool_calls: {
                      type: "array",
                      description: "Optional action tool calls.",
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
                              task: { type: "string" },
                              subject: { type: "string" },
                            },
                          },
                        },
                        required: ["name"],
                      },
                    },
                    notes_zu: { type: "string", description: "Additional isiZulu cultural notes, izaga, or context." },
                    sovereignty_signal: { type: "string", description: "Brief note on what a sovereign model adds here vs generic AI." },
                  },
                  required: ["description", "emotion", "intensity"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "vision_response" } },
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
      console.error("Sovereign heritage error:", response.status, errText);
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
          description: data.choices?.[0]?.message?.content || "Ngiyabona isimo.",
          emotion: "neutral",
          intensity: 0.3,
        };
      }
    } else {
      result = {
        description: data.choices?.[0]?.message?.content || "Ngiyabona isimo.",
        emotion: "neutral",
        intensity: 0.3,
      };
    }

    // Tag as sovereign for logging
    result.source = "sovereign-heritage";
    result.model = "gemini-2.5-pro";

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sovereign heritage error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
