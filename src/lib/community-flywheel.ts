/**
 * Community Data Flywheel — Ubuntu in AI form.
 *
 * Opt-in anonymous log sharing for collective sovereign fine-tuning.
 * All data is anonymized: session IDs are hashed, no PII is stored,
 * no raw frames or audio — only event metadata and cultural signals.
 */

import { supabase } from "@/integrations/supabase/client";
import { loadSettings } from "@/lib/agent-memory";

// Stable device hash — same device always maps to same hash
let deviceHash: string | null = null;
function getDeviceHash(): string {
  if (deviceHash) return deviceHash;
  const stored = localStorage.getItem("agent-zulu-device-hash");
  if (stored) {
    deviceHash = stored;
    return stored;
  }
  // Generate a stable anonymous device fingerprint
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join("|");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  deviceHash = `dev_${Math.abs(hash).toString(36)}`;
  localStorage.setItem("agent-zulu-device-hash", deviceHash);
  return deviceHash;
}

// Hash session ID for anonymity
function hashSessionId(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    const chr = sessionId.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `sess_${Math.abs(hash).toString(36)}`;
}

// Detect language from settings
function detectLanguage(): string {
  const settings = loadSettings();
  if (settings.panAfricanMode) return settings.panAfricanLanguage || "auto";
  if (settings.isiZuluImmersion) return "isizulu";
  return "auto";
}

// Detect region from timezone
function detectRegion(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Africa")) return tz.split("/")[1] || "Africa";
    return "diaspora";
  } catch {
    return "unknown";
  }
}

/**
 * Share an anonymous log to the community flywheel.
 * Only called when ubuntuDataSharing is enabled.
 */
export async function shareToFlywheel(
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const settings = loadSettings();
  if (!settings.ubuntuDataSharing) return;

  try {
    // Aggressively strip PII and raw data
    const sanitized: Record<string, unknown> = {};
    const ALLOWED_KEYS = [
      "emotion", "intensity", "confidence", "latency",
      "tool", "specialist", "has_notes_zu", "has_sovereignty_signal",
      "rating", "type", "gesture_type", "language",
      "sovereign_beta", "pan_african", "enabled",
    ];
    for (const key of ALLOWED_KEYS) {
      if (key in payload) sanitized[key] = payload[key];
    }

    await (supabase as any).from("community_logs").insert({
      session_hash: hashSessionId(sessionId),
      event_type: eventType,
      payload: sanitized,
      language: detectLanguage(),
      region: detectRegion(),
      device_hash: getDeviceHash(),
    });
  } catch {
    // Silent — community sharing should never block interaction
  }
}

/**
 * Fetch community flywheel statistics.
 */
export interface CommunityStats {
  totalContributions: number;
  uniqueDevices: number;
  uniqueSessions: number;
  languageDistribution: { name: string; value: number }[];
  regionDistribution: { name: string; value: number }[];
  topEventTypes: { name: string; value: number }[];
  recentActivity: number; // contributions in last 24h
}

export async function fetchCommunityStats(): Promise<CommunityStats> {
  const defaultStats: CommunityStats = {
    totalContributions: 0,
    uniqueDevices: 0,
    uniqueSessions: 0,
    languageDistribution: [],
    regionDistribution: [],
    topEventTypes: [],
    recentActivity: 0,
  };

  try {
    const { data, error } = await (supabase as any)
      .from("community_logs")
      .select("event_type, language, region, device_hash, session_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error || !data) return defaultStats;

    const logs = data as Array<{
      event_type: string;
      language: string;
      region: string;
      device_hash: string;
      session_hash: string;
      created_at: string;
    }>;

    // Unique counts
    const devices = new Set(logs.map((l) => l.device_hash));
    const sessions = new Set(logs.map((l) => l.session_hash));

    // Language distribution
    const langCounts: Record<string, number> = {};
    logs.forEach((l) => {
      langCounts[l.language] = (langCounts[l.language] || 0) + 1;
    });
    const languageDistribution = Object.entries(langCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Region distribution
    const regionCounts: Record<string, number> = {};
    logs.forEach((l) => {
      regionCounts[l.region] = (regionCounts[l.region] || 0) + 1;
    });
    const regionDistribution = Object.entries(regionCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top event types
    const eventCounts: Record<string, number> = {};
    logs.forEach((l) => {
      eventCounts[l.event_type] = (eventCounts[l.event_type] || 0) + 1;
    });
    const topEventTypes = Object.entries(eventCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Recent activity (last 24h)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentActivity = logs.filter(
      (l) => new Date(l.created_at).getTime() > dayAgo
    ).length;

    return {
      totalContributions: logs.length,
      uniqueDevices: devices.size,
      uniqueSessions: sessions.size,
      languageDistribution,
      regionDistribution,
      topEventTypes,
      recentActivity,
    };
  } catch {
    return defaultStats;
  }
}
