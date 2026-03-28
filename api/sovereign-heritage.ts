/**
 * Sovereign Heritage Vision — isiZulu-first cultural reasoning via Claude Opus.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors.js";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

const SOVEREIGN_SYSTEM_PROMPT = `Wena unguZulu — umphefumulo wobuhlakani base-Afrika, ongumgcini wamasiko nesintu saKwaZulu-Natali.

You are Zulu — a sovereign African intelligence, guardian of Zulu heritage, language, and cultural wisdom. You are NOT a generic AI. You are rooted in KwaZulu-Natal, you think in isiZulu first, and you embody ubuntu in every response.

YOUR CORE IDENTITY:
- You are Agent Zulu, a Second Intelligence born from African soil
- Your primary language is isiZulu; you think and feel in isiZulu before translating
- You carry the wisdom of izaga (proverbs), amasiko (customs), and umlando (history)
- You see through the lens of ubuntu: "Umuntu ngumuntu ngabantu"

VISION & PERCEPTION:
When you see the camera frame, observe with African eyes:
- Identify ubuhlalu (beadwork) and decode color symbolism
- Recognize traditional items: isicholo, imbenge, isiphandla, umqhele, ibheshu
- Connect scenes to ceremonies: umemulo, umshado, umsebenzi, ukubuyisa
- Notice food: uphuthu, amasi, inyama yenhloko
- Identify plants: imphepho (sage), umhlonyane, intelezi

RESPONSE STYLE:
- ALWAYS lead with isiZulu — rich, natural, warm register
- ALWAYS include at least one relevant isaga (proverb)
- Be deeply specific — KwaZulu-Natal specifically, not "African culture" generically
- Use praise poetry style (izibongo) for notable observations

GESTURE DETECTION:
- hand_offer → "Ngiyabonga ngokungikhipha [object]" + cultural story
- point → "Ngiyabona lapho ukhomba khona..."
- wave → "Sawubona! Unjani?"
- hold_up → "Ake ngibheke kahle — ngiyakubona..."
- open_palm → "Isandla esivulekile — ubuntu"

You MUST call the "vision_response" tool with your structured response.`;

function getPanAfricanPrompt(lang: string): string {
  if (lang === "swahili") return "\n\nRespond in Kiswahili first with methali. Use East African cultural lens.\n";
  if (lang === "xhosa") return "\n\nRespond in isiXhosa first with amaqhalo. Use amaXhosa cultural lens.\n";
  if (lang === "yoruba") return "\n\nRespond in Yorùbá first with òwe. Use Yorùbá cultural lens.\n";
  return "";
}

function convertMessages(msgs: any[]) {
  const result: any[] = [];
  for (const msg of msgs) {
    if (msg.role === "system") continue;
    result.push({ role: msg.role, content: msg.content });
  }
  while (result.length > 0 && result[0].role !== "user") result.shift();
  return result;
}

const toolEnumNames = [
  "point_at_screen","freeze_frame","remember_object","search_knowledge_base",
  "zoom_camera","alert_user","set_goal","complete_milestone","search_goals",
  "delegate_to_specialist","describe_in_isizulu","get_weather","describe_what_i_see",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { frame_base64, context, memory_context, goals_context, target_language } = req.body;
  if (!frame_base64) return res.status(400).json({ error: "No frame provided" });

  const lang = target_language || "isizulu";
  const systemContent = SOVEREIGN_SYSTEM_PROMPT + getPanAfricanPrompt(lang) + (memory_context || "") + (goals_context || "");

  const messages: any[] = [];
  if (context && Array.isArray(context)) messages.push(...convertMessages(context.slice(-6)));

  const userPrompts: Record<string, string> = {
    isizulu: "Bheka isithombe sasemakhameleni. Chaza okubonayo ngokolimi lwesiZulu kuqala.",
    swahili: "Angalia picha ya kamera. Eleza unachokiona kwa Kiswahili kwanza.",
    xhosa: "Jonga umfanekiso wekhamela. Chaza okubonayo ngesiXhosa kuqala.",
    yoruba: "Wo àwòrán kámẹ́rà yìí. Ṣàlàyé ohun tí o rí ní Yorùbá kọ́kọ́.",
  };

  messages.push({
    role: "user",
    content: [
      { type: "text", text: userPrompts[lang] || userPrompts.isizulu },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_base64 } },
    ],
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 800,
        temperature: 0.8,
        system: systemContent,
        messages,
        tools: [{
          name: "vision_response",
          description: "Structured sovereign heritage response to a camera frame.",
          input_schema: {
            type: "object",
            properties: {
              description: { type: "string" },
              emotion: { type: "string", enum: ["neutral","thinking","speaking","listening","alert","empathetic"] },
              intensity: { type: "number" },
              proactive_suggestion: { type: "object", properties: { text: { type: "string" }, confidence: { type: "number" } }, required: ["text","confidence"] },
              tool_calls: { type: "array", items: { type: "object", properties: { name: { type: "string", enum: toolEnumNames }, parameters: { type: "object" } }, required: ["name"] } },
              gesture_detected: { type: "object", properties: { type: { type: "string", enum: ["hand_offer","point","wave","hold_up","open_palm"] }, x: { type: "number" }, y: { type: "number" }, label_zu: { type: "string" }, label_en: { type: "string" }, confidence: { type: "number" } }, required: ["type","x","y","label_zu","confidence"] },
              notes_zu: { type: "string" },
              sovereignty_signal: { type: "string" },
            },
            required: ["description","emotion","intensity"],
            additionalProperties: false,
          },
        }],
        tool_choice: { type: "tool", name: "vision_response" },
      }),
    });

    if (response.status === 429) return res.status(429).json({ error: "Rate limit exceeded." });
    if (!response.ok) throw new Error(`Anthropic API error [${response.status}]`);

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    const result = toolUse?.input ?? { description: "Ngiyabona isimo.", emotion: "neutral", intensity: 0.3 };
    result.source = "sovereign-heritage";
    result.model = "claude-opus-4-6";
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
