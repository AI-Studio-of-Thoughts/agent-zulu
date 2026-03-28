import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors.js";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.DATABASE_URL) return res.json([]);

  try {
    const sql = neon(process.env.DATABASE_URL);
    const logs = await sql`
      SELECT id, session_id, event_type, payload, user_id, created_at
      FROM session_logs
      ORDER BY created_at DESC
      LIMIT 500
    `;
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
}
