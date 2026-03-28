/**
 * Community Data Flywheel — Ubuntu in AI form.
 *
 * Opt-in anonymous log sharing for collective sovereign fine-tuning.
 * All data is anonymized: session IDs are hashed, no PII is stored,
 * no raw frames or audio — only event metadata and cultural signals.
 *
 * Failed operations are queued via the offline outbox for later retry.
 */

import { loadSettings } from "@/lib/agent-memory";
import { enqueue } from "@/lib/offline-outbox";

// Stable device hash — same device always maps to same hash
let deviceHash: string | null = null;
function getDeviceHash(): string {
  if (deviceHash) return deviceHash;
  const stored = localStorage.getItem("agent-zulu-device-hash");
  if (stored) {
    deviceHash = stored;
    return stored;
  }
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join("|");
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

function hashSessionId(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    const chr = sessionId.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `sess_${Math.abs(hash).toString(36)}`;
}

function detectLanguage(): string {
  const settings = loadSettings();
  if (settings.panAfricanMode) return settings.panAfricanLanguage || "auto";
  if (settings.isiZuluImmersion) return "isizulu";
  return "auto";
}

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
 * Failed inserts are queued for offline retry.
 */
export async function shareToFlywheel(
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const settings = loadSettings();
  if (!settings.ubuntuDataSharing) return;

  // Aggressively strip PII
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

  const row = {
    session_hash: hashSessionId(sessionId),
    event_type: eventType,
    payload: sanitized,
    language: detectLanguage(),
    region: detectRegion(),
    device_hash: getDeviceHash(),
  };

  try {
    const response = await fetch("/api/log-community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    // Queue for offline retry
    await enqueue("community_logs", row);
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
  recentActivity: number;
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
    const response = await fetch("/api/community-stats");
    if (!response.ok) return defaultStats;
    return await response.json() as CommunityStats;
  } catch {
    return defaultStats;
  }
}
