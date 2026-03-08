/**
 * Sovereign Shadow Logger
 *
 * Anonymized session telemetry for sovereign model training.
 * Logs tool calls, specialist delegations, proactive triggers, and metadata
 * (NO raw frames or audio) to Supabase — only when user opts in.
 */

import { supabase } from "@/integrations/supabase/client";
import { loadSettings } from "@/lib/agent-memory";

let sessionId: string | null = null;

export function startShadowSession(): string {
  sessionId = crypto.randomUUID();
  return sessionId;
}

export function endShadowSession(): void {
  sessionId = null;
}

export async function shadowLog(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const settings = loadSettings();
  if (!settings.sovereignTraining || !sessionId) return;

  try {
    // Strip any raw frame data — only metadata
    const sanitized = { ...payload };
    delete sanitized.frame_base64;
    delete sanitized.frame;
    delete sanitized.audio;

    await supabase.from("session_logs").insert({
      session_id: sessionId,
      event_type: eventType,
      payload: sanitized,
    });
  } catch (err) {
    // Silent fail — telemetry should never block interaction
    console.debug("[ShadowLog] Failed:", err);
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
