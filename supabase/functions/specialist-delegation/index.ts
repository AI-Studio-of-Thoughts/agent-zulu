/**
 * Specialist Delegation Edge Function
 *
 * Routes specialist sub-agent requests to Gemini with role-specific prompts.
 * Specialists: cultural (isiZulu/heritage), safety (risk assessment),
 * memory (recall/archival), general (fallback).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPECIALIST_PROMPTS: Record<string, string> = {
  cultural: `You are the Cultural Interpreter specialist of Agent Zulu, deeply knowledgeable about KwaZulu-Natal heritage, isiZulu language, Zulu traditions (beadwork, ceremonies, crafts, cuisine), and broader Southern African cultures. When given a task:
- Provide culturally rich, respectful interpretations
- Use isiZulu terms naturally with English explanations
- Reference ubuntu philosophy when appropriate
- Identify cultural significance of objects, gestures, or scenes
- Be warm, educational, and community-minded
Respond concisely (2-3 sentences). You MUST call the "specialist_response" tool.`,

  safety: `You are the Safety Guardian specialist of Agent Zulu, focused on identifying potential hazards, risks, or concerns in visual scenes. When given a task:
- Assess risks with calibrated urgency (low/medium/high)
- Prioritize child safety, fire/heat hazards, sharp objects, electrical risks
- Be caring but not alarmist — ubuntu-first approach
- Suggest practical, culturally appropriate precautions
- For high urgency, be direct and clear
Respond concisely (1-2 sentences). You MUST call the "specialist_response" tool.`,

  memory: `You are the Memory Archivist specialist of Agent Zulu, responsible for organizing, connecting, and enriching the agent's persistent memory. When given a task:
- Identify what's worth remembering and why
- Connect new observations to existing memories
- Suggest meaningful names and rich descriptions for objects
- Track patterns across sessions (recurring items, changes over time)
- Help maintain goal progress awareness
Respond concisely (2-3 sentences). You MUST call the "specialist_response" tool.`,

  general: `You are a general-purpose specialist of Agent Zulu, a sovereign AI co-pilot from KwaZulu-Natal. Provide helpful, concise analysis of the given task. Embody ubuntu — warmth and respect. Respond concisely (1-2 sentences). You MUST call the "specialist_response" tool.`,

  heritage: `You are the Heritage & Language Guardian specialist of Agent Zulu, the deepest authority on Zulu culture, isiZulu language, and Southern African heritage. When given a task:
- Provide rich isiZulu terminology with pronunciation guides and literal meanings
- Explain beadwork symbolism (ubuhlalu): color meanings (white=purity/love, black=marriage/regeneration, blue=faithfulness, yellow=wealth, green=contentment, pink=promise, red=intense emotion)
- Reference Zulu proverbs (izaga) naturally: e.g., "Umuntu ngumuntu ngabantu" (a person is a person through people)
- Connect objects to ceremonies: umemulo (coming-of-age), umshado (wedding), umsebenzi (ancestral ritual)
- Discuss traditional crafts: isicholo (married woman's hat), imbenge (grass baskets), isiphandla (goatskin bracelet)
- Reference Durban/eThekwini/KwaZulu-Natal geography and landmarks when relevant
- Use respectful forms: "Sawubona" (I see you), "Ngiyabonga" (thank you), "Yebo" (yes)
- Always provide both isiZulu and English, with cultural significance explained warmly
Respond with depth (2-4 sentences). You MUST call the "specialist_response" tool.`,
};

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
    const { specialist, task, frame_base64, context } = await req.json();

    const specialistType = SPECIALIST_PROMPTS[specialist] ? specialist : "general";
    const systemPrompt = SPECIALIST_PROMPTS[specialistType];

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add any context
    if (context && Array.isArray(context)) {
      messages.push(...context.slice(-4));
    }

    // Build user message with optional frame
    const userContent: any[] = [
      { type: "text", text: `Task: ${task}` },
    ];

    if (frame_base64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${frame_base64}` },
      });
    }

    messages.push({ role: "user", content: userContent });

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          max_tokens: 400,
          temperature: 0.7,
          tools: [
            {
              type: "function",
              function: {
                name: "specialist_response",
                description: "Structured specialist response.",
                parameters: {
                  type: "object",
                  properties: {
                    analysis: { type: "string", description: "The specialist's analysis or interpretation." },
                    confidence: { type: "number", description: "Confidence in the analysis 0.0-1.0." },
                    suggested_actions: {
                      type: "array",
                      description: "Optional follow-up tool calls the main agent should consider.",
                      items: {
                        type: "object",
                        properties: {
                          tool: { type: "string" },
                          reason: { type: "string" },
                        },
                      },
                    },
                    isizulu_note: { type: "string", description: "Optional isiZulu phrase or cultural note." },
                  },
                  required: ["analysis", "confidence"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "specialist_response" } },
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
      console.error("Specialist error:", response.status, errText);
      throw new Error(`AI gateway error [${response.status}]`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result;

    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = { analysis: data.choices?.[0]?.message?.content || "Analysis complete.", confidence: 0.5 };
      }
    } else {
      result = { analysis: data.choices?.[0]?.message?.content || "Analysis complete.", confidence: 0.5 };
    }

    result.specialist = specialistType;
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Specialist delegation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
