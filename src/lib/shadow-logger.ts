/**
 * Sovereign Shadow Logger
 *
 * Anonymized session telemetry for sovereign model training.
 * Logs tool calls, specialist delegations, proactive triggers, and metadata
 * (NO raw frames or audio) to Supabase — only when user opts in.
 *
 * Also feeds the Community Data Flywheel when ubuntu sharing is enabled.
 * Failed operations are queued via the offline outbox for later retry.
 */

import { supabase } from "@/integrations/supabase/client";
import { loadSettings } from "@/lib/agent-memory";
import { shareToFlywheel } from "@/lib/community-flywheel";
import { enqueue } from "@/lib/offline-outbox";

let sessionId: string | null = null;

export function startShadowSession(): string {
  sessionId = crypto.randomUUID();
  return sessionId;
}

export function endShadowSession(): void {
  sessionId = null;
}

export function getSessionId(): string | null {
  return sessionId;
}

export async function shadowLog(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const settings = loadSettings();
  if (!sessionId) return;

  // Strip raw data
  const sanitized = { ...payload };
  delete sanitized.frame_base64;
  delete sanitized.frame;
  delete sanitized.audio;

  // Private session logs (sovereign training)
  if (settings.sovereignTraining) {
    try {
      const { error } = await (supabase as any).from("session_logs").insert({
        session_id: sessionId,
        event_type: eventType,
        payload: sanitized,
      });
      if (error) throw error;
    } catch {
      // Queue for retry
      await enqueue("session_logs", {
        session_id: sessionId,
        event_type: eventType,
        payload: sanitized,
      });
    }
  }

  // Community flywheel (ubuntu sharing)
  if (settings.ubuntuDataSharing) {
    shareToFlywheel(sessionId, eventType, sanitized);
  }
}

// Convenience loggers
export const logToolCall = (toolName: string, params: Record<string, unknown>, result: string) =>
  shadowLog("tool_call", { tool: toolName, params, result });

export const logSpecialistDelegation = (specialist: string, task: string, analysis: string) =>
  shadowLog("specialist_delegation", { specialist, task, analysis });

export const logProactiveTrigger = (text: string, confidence: number) =>
  shadowLog("proactive_trigger", { text, confidence });

export const logVisionResponse = (description: string, emotion: string, intensity: number) =>
  shadowLog("vision_response", { description, emotion, intensity });

export const logAlertTriggered = (message: string, urgency: string) =>
  shadowLog("alert_triggered", { message, urgency });
