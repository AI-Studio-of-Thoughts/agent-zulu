import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_cors";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.DATABASE_URL) {
    return res.json({ totalContributions: 0, uniqueDevices: 0, uniqueSessions: 0, languageDistribution: [], regionDistribution: [], topEventTypes: [], recentActivity: 0 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const logs = await sql`
      SELECT event_type, language, region, device_hash, session_hash, created_at
      FROM community_logs
      ORDER BY created_at DESC
      LIMIT 1000
    ` as any[];

    const devices = new Set(logs.map((l) => l.device_hash));
    const sessions = new Set(logs.map((l) => l.session_hash));

    const langCounts: Record<string, number> = {};
    logs.forEach((l) => { langCounts[l.language] = (langCounts[l.language] || 0) + 1; });

    const regionCounts: Record<string, number> = {};
    logs.forEach((l) => { regionCounts[l.region] = (regionCounts[l.region] || 0) + 1; });

    const eventCounts: Record<string, number> = {};
    logs.forEach((l) => { eventCounts[l.event_type] = (eventCounts[l.event_type] || 0) + 1; });

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

    return res.json({
      totalContributions: logs.length,
      uniqueDevices: devices.size,
      uniqueSessions: sessions.size,
      languageDistribution: Object.entries(langCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      regionDistribution: Object.entries(regionCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      topEventTypes: Object.entries(eventCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6),
      recentActivity: logs.filter((l) => new Date(l.created_at).getTime() > dayAgo).length,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Stats query failed" });
  }
}
