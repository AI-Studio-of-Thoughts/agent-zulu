import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: "DATABASE_URL not configured" });

  const { session_hash, event_type, payload, language, region, device_hash } = req.body;
  if (!session_hash || !event_type) return res.status(400).json({ error: "session_hash and event_type required" });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      INSERT INTO community_logs (session_hash, event_type, payload, language, region, device_hash)
      VALUES (
        ${session_hash},
        ${event_type},
        ${JSON.stringify(payload || {})}::jsonb,
        ${language || "isizulu"},
        ${region || "unknown"},
        ${device_hash || "unknown"}
      )
    `;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Insert failed" });
  }
}
