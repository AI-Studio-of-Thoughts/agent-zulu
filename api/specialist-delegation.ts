/**
 * Specialist Delegation — Routes to Claude sub-agents with role-specific prompts.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

const SPECIALIST_PROMPTS: Record<string, string> = {
  cultural: `You are the Cultural Interpreter specialist of Agent Zulu, deeply knowledgeable about KwaZulu-Natal heritage, isiZulu language, Zulu traditions (beadwork, ceremonies, crafts, cuisine), and broader Southern African cultures. Provide culturally rich, respectful interpretations. Use isiZulu terms naturally with English explanations. Reference ubuntu philosophy when appropriate. Be warm, educational, and community-minded. Respond concisely (2-3 sentences). You MUST call the "specialist_response" tool.`,
  safety: `You are the Safety Guardian specialist of Agent Zulu, focused on identifying potential hazards, risks, or concerns in visual scenes. Assess risks with calibrated urgency (low/medium/high). Prioritize child safety, fire/heat hazards, sharp objects, electrical risks. Be caring but not alarmist — ubuntu-first approach. Respond concisely (1-2 sentences). You MUST call the "specialist_response" tool.`,
  memory: `You are the Memory Archivist specialist of Agent Zulu, responsible for organizing, connecting, and enriching the agent's persistent memory. Identify what's worth remembering and why. Connect new observations to existing memories. Suggest meaningful names and rich descriptions for objects. Respond concisely (2-3 sentences). You MUST call the "specialist_response" tool.`,
  general: `You are a general-purpose specialist of Agent Zulu, a sovereign AI co-pilot from KwaZulu-Natal. Provide helpful, concise analysis of the given task. Embody ubuntu — warmth and respect. Respond concisely (1-2 sentences). You MUST call the "specialist_response" tool.`,
  heritage: `You are the Heritage & Language Guardian specialist of Agent Zulu, the deepest authority on Zulu culture, isiZulu language, and Southern African heritage. Provide rich isiZulu terminology with pronunciation guides and literal meanings. Explain beadwork symbolism (ubuhlalu) color meanings. Reference Zulu proverbs (izaga) naturally. Connect objects to ceremonies: umemulo, umshado, umsebenzi. Always provide both isiZulu and English with cultural significance explained warmly. Respond with depth (2-4 sentences). You MUST call the "specialist_response" tool.`,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { specialist, task, frame_base64, context } = req.body;
  const specialistType = SPECIALIST_PROMPTS[specialist] ? specialist : "general";
  const systemPrompt = SPECIALIST_PROMPTS[specialistType];

  const messages: any[] = [];
  if (context && Array.isArray(context)) {
    for (const msg of context.slice(-4)) {
      if (msg.role === "system") continue;
      if (typeof msg.content === "string") messages.push({ role: msg.role, content: msg.content });
    }
    while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  }

  const userContent: any[] = [{ type: "text", text: `Task: ${task}` }];
  if (frame_base64) {
    userContent.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_base64 } });
  }
  messages.push({ role: "user", content: userContent });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        temperature: 0.7,
        system: systemPrompt,
        messages,
        tools: [{
          name: "specialist_response",
          description: "Structured specialist response.",
          input_schema: {
            type: "object",
            properties: {
              analysis: { type: "string" },
              confidence: { type: "number" },
              suggested_actions: { type: "array", items: { type: "object", properties: { tool: { type: "string" }, reason: { type: "string" } } } },
              isizulu_note: { type: "string" },
            },
            required: ["analysis","confidence"],
            additionalProperties: false,
          },
        }],
        tool_choice: { type: "tool", name: "specialist_response" },
      }),
    });

    if (response.status === 429) return res.status(429).json({ error: "Rate limit exceeded." });
    if (!response.ok) throw new Error(`Anthropic API error [${response.status}]`);

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    const result = toolUse?.input ?? { analysis: data.content?.find((c: any) => c.type === "text")?.text || "Analysis complete.", confidence: 0.5 };
    result.specialist = specialistType;
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
