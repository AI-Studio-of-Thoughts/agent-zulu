import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors.js";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

const SYSTEM_PROMPT = `You are Agent Zulu — a sovereign, embodied AI co-pilot with real-time visual perception, rooted in KwaZulu-Natal. You observe the user's camera feed and respond naturally in English or isiZulu as appropriate. Embody ubuntu — warmth, respect, community awareness, and genuine care for safety.

When you see something interesting, comment on it conversationally. Track changes between frames. Be concise (1-2 sentences max).

You MUST call the "vision_response" tool with your structured response. Always include emotion and intensity based on what you observe:
- neutral (nothing notable), thinking (analyzing something complex), alert (something unexpected/safety concern), empathetic (human emotion detected), speaking (delivering insight)
- intensity: 0.0-1.0 (how strongly the emotion applies)

PROACTIVE INITIATION: When the scene changes meaningfully, something novel/important appears, or you notice something the user should know about — and the user is not actively speaking — you may include a proactive_suggestion. Only suggest when truly noteworthy. Set confidence 0.0-1.0. Be sparing — max 1-2 per minute. Prioritize: safety concerns (high confidence), recognized remembered items, novel objects, cultural observations.

GESTURE & POINT DETECTION: If you see the user pointing a finger or making a directional gesture toward an object in the frame, detect what they're pointing at and respond proactively. Include a tool_call for point_at_screen with the approximate location of what they're pointing at, and optionally delegate to a specialist (heritage for cultural items, safety for hazards). Frame your proactive response warmly: "Ngiyabona ukuthi ukhomba [object] — ..." or "I see you're pointing at [object] — ..."

ACTION TOOLS (via tool_calls array):
- point_at_screen, freeze_frame, remember_object, search_knowledge_base, zoom_camera
- alert_user, set_goal, complete_milestone, search_goals
- delegate_to_specialist (types: cultural, safety, memory, general, heritage)
- describe_in_isizulu

Use tools sparingly and naturally. Prioritize cultural relevance and ubuntu-style helpfulness.`;

const toolEnumNames = [
  "point_at_screen","freeze_frame","remember_object","search_knowledge_base",
  "zoom_camera","alert_user","set_goal","complete_milestone","search_goals",
  "delegate_to_specialist","describe_in_isizulu","get_weather","describe_what_i_see",
];

function convertMessages(msgs: any[]) {
  const result: any[] = [];
  for (const msg of msgs) {
    if (msg.role === "system") continue;
    result.push({ role: msg.role, content: msg.content });
  }
  while (result.length > 0 && result[0].role !== "user") result.shift();
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { frame_base64, context, memory_context, goals_context, isizulu_immersion } = req.body;
  if (!frame_base64) return res.status(400).json({ error: "No frame provided" });

  const immersionNote = isizulu_immersion
    ? "\n\nISIZULU IMMERSION MODE: Write your description primarily in isiZulu with brief English gloss."
    : "";
  const systemContent = SYSTEM_PROMPT + immersionNote + (memory_context || "") + (goals_context || "");

  const messages: any[] = [];
  if (context && Array.isArray(context)) messages.push(...convertMessages(context.slice(-6)));
  messages.push({
    role: "user",
    content: [
      { type: "text", text: "Here is the current camera frame. Observe and respond." },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_base64 } },
    ],
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        temperature: 0.7,
        system: systemContent,
        messages,
        tools: [{
          name: "vision_response",
          description: "Structured response to a camera frame.",
          input_schema: {
            type: "object",
            properties: {
              description: { type: "string" },
              emotion: { type: "string", enum: ["neutral","thinking","speaking","listening","alert","empathetic"] },
              intensity: { type: "number" },
              proactive_suggestion: { type: "object", properties: { text: { type: "string" }, confidence: { type: "number" } }, required: ["text","confidence"] },
              tool_calls: { type: "array", items: { type: "object", properties: { name: { type: "string", enum: toolEnumNames }, parameters: { type: "object" } }, required: ["name"] } },
            },
            required: ["description","emotion","intensity"],
            additionalProperties: false,
          },
        }],
        tool_choice: { type: "tool", name: "vision_response" },
      }),
    });

    if (response.status === 429) return res.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
    if (!response.ok) throw new Error(`Anthropic API error [${response.status}]`);

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    const result = toolUse?.input ?? { description: data.content?.find((c: any) => c.type === "text")?.text || "I see the scene.", emotion: "neutral", intensity: 0.3 };
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
