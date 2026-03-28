import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors.js";

const ELEVENLABS_AGENT_ID = "agent_5701kmv2m6kseps9psy6yr9nxxze";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
      { headers: { "xi-api-key": apiKey } }
    );
    if (!response.ok) throw new Error(`ElevenLabs API error [${response.status}]`);
    const data = await response.json();
    return res.json({ signed_url: data.signed_url });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
