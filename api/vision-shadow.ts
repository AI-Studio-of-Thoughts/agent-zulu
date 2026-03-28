/**
 * Vision Shadow — Parallel comparison across Claude Haiku, Sonnet, and Opus.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

const SHADOW_SYSTEM = `You are Agent Zulu — a sovereign, embodied AI co-pilot rooted in KwaZulu-Natal. Observe a camera frame and respond naturally in English or isiZulu. Embody ubuntu — warmth, respect, community awareness. Be concise (1-2 sentences max). You MUST call the "vision_response" tool.`;

const SHADOW_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"];

const TOOL = {
  name: "vision_response",
  description: "Structured response to a camera frame.",
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string" },
      emotion: { type: "string", enum: ["neutral","thinking","speaking","listening","alert","empathetic"] },
      intensity: { type: "number" },
      isizulu_quality: { type: "string", enum: ["none","basic","fluent","proverbial"] },
      cultural_depth: { type: "number" },
    },
    required: ["description","emotion","intensity"],
    additionalProperties: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { frame_base64, isizulu_immersion, primary_result } = req.body;
  if (!frame_base64) return res.status(400).json({ error: "No frame provided" });

  const systemContent = SHADOW_SYSTEM + (isizulu_immersion ? "\n\nISIZULU IMMERSION MODE: Respond primarily in isiZulu with brief English gloss." : "");
  const userMessage = {
    role: "user",
    content: [
      { type: "text", text: "Observe this camera frame and respond." },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_base64 } },
    ],
  };

  const results = await Promise.allSettled(
    SHADOW_MODELS.map(async (model) => {
      const start = Date.now();
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model, max_tokens: 300, temperature: 0.7, system: systemContent, messages: [userMessage], tools: [TOOL], tool_choice: { type: "tool", name: "vision_response" } }),
        });
        const latency = Date.now() - start;
        if (!r.ok) return { model, latency, error: `HTTP ${r.status}` };
        const d = await r.json();
        const toolUse = d.content?.find((c: any) => c.type === "tool_use");
        return { model, latency, result: toolUse?.input ?? { description: "Parse failed", emotion: "neutral", intensity: 0.3 } };
      } catch (e) {
        return { model, latency: Date.now() - start, error: e instanceof Error ? e.message : "Unknown" };
      }
    })
  );

  const comparison = results.map((r, i) => r.status === "fulfilled" ? r.value : { model: SHADOW_MODELS[i], error: (r as PromiseRejectedResult).reason?.message });
  return res.json({ primary_model: "claude-sonnet-4-6", primary_result: primary_result || null, shadow_results: comparison, timestamp: Date.now() });
}
