/**
 * Gemini Vision Reasoning Adapter (with goals context)
 *
 * Vision-only adapter that sends camera frames to Gemini 2.5 Flash
 * via the vision-reasoning edge function. Does NOT handle voice —
 * designed to run alongside ElevenLabs in a HybridAdapter.
 *
 * Responsibilities:
 * - Accept frames via sendFrame()
 * - Throttle to ~1 frame every 4 seconds (avoid API hammering)
 * - Send to edge function, parse structured response
 * - Emit avatar_state, transcript, and tool_call events
 */

import { formatMemoriesForPrompt, formatGoalsForPrompt, loadSettings } from "@/lib/agent-memory";
import { shadowLog } from "@/lib/shadow-logger";
import type {
  AgentBackendAdapter,
  AgentEventHandler,
  AvatarEmotion,
  AvatarState,
  ConnectionStatus,
  SessionConfig,
  ToolHandler,
  VisionCapabilities,
  VoiceState,
} from "../types";

export class GeminiVisionAdapter implements AgentBackendAdapter {
  readonly name = "Gemini Vision Reasoning";

  private _status: ConnectionStatus = "disconnected";
  private _voiceState: VoiceState = {
    isSpeaking: false,
    isListening: false,
    outputLevel: 0,
    inputLevel: 0,
  };
  private _avatarState: AvatarState = { emotion: "neutral", intensity: 0.2 };
  private _vision: VisionCapabilities;

  private handlers = new Set<AgentEventHandler>();
  private toolHandlers: Record<string, ToolHandler> = {};
  private context: Array<{ role: string; content: string }> = [];

  // Throttle: min interval between frame sends (ms)
  private minFrameInterval = 6000;
  private backoffUntil = 0;
  private lastFrameTime = 0;
  private processing = false;

  constructor() {
    this._vision = {
      supportsVision: true,
      sendFrame: this.handleFrame.bind(this),
    };
  }

  get status() { return this._status; }
  get voiceState() { return this._voiceState; }
  get avatarState() { return this._avatarState; }
  get vision() { return this._vision; }

  private emit(event: Parameters<AgentEventHandler>[0]) {
    this.handlers.forEach((h) => h(event));
  }

  async connect(config: SessionConfig): Promise<void> {
    this._status = "connected";
    this.context = [];
    this.emit({ type: "status", status: "connected" });
  }

  async disconnect(): Promise<void> {
    this._status = "disconnected";
    this.context = [];
    this.emit({ type: "status", status: "disconnected" });
  }

  setMicMuted(_muted: boolean): void {
    // Voice handled by ElevenLabs in hybrid mode
  }

  setVolume(_volume: number): void {
    // Voice handled by ElevenLabs in hybrid mode
  }

  on(handler: AgentEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  registerTools(tools: Record<string, ToolHandler>): void {
    this.toolHandlers = { ...this.toolHandlers, ...tools };
  }

  sendMessage(text: string): void {
    this.context.push({ role: "user", content: text });
  }

  destroy(): void {
    this.handlers.clear();
    this.context = [];
  }

  // ── Vision Pipeline ──────────────────────────────────────

  private async handleFrame(frame: ImageData | Blob): Promise<void> {
    const now = Date.now();
    if (now - this.lastFrameTime < this.minFrameInterval) return;
    if (this.processing) return;
    if (this._status !== "connected") return;
    if (now < this.backoffUntil) return; // rate-limit backoff

    this.lastFrameTime = now;
    this.processing = true;

    try {
      const base64 = await this.blobToBase64(frame);

      const currentSettings = loadSettings();
      const memoryContext = currentSettings.memoryEnabled ? formatMemoriesForPrompt() : "";
      const goalsContext = currentSettings.memoryEnabled ? formatGoalsForPrompt() : "";

      const visionResponse = await fetch("/api/vision-reasoning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame_base64: base64,
          context: this.context,
          memory_context: memoryContext,
          goals_context: goalsContext,
          isizulu_immersion: currentSettings.isiZuluImmersion,
        }),
      });

      if (!visionResponse.ok) {
        const errBody = await visionResponse.json().catch(() => ({}));
        const msg = errBody.error || `HTTP ${visionResponse.status}`;
        if (msg.includes("429") || msg.includes("Rate limit")) {
          console.warn("[GeminiVision] Rate limited — backing off 30s");
          this.backoffUntil = Date.now() + 30000;
          return;
        }
        console.error("[GeminiVision] API error:", msg);
        this.emit({ type: "error", error: msg || "Vision reasoning failed" });
        return;
      }

      const data = await visionResponse.json();
      if (!data) return;

      // Update avatar state from Gemini's response
      const emotion = this.validateEmotion(data.emotion);
      const intensity = Math.max(0, Math.min(1, data.intensity ?? 0.5));
      this._avatarState = { emotion, intensity, label: data.description };
      this.emit({ type: "avatar_state", state: this._avatarState });

      // Emit transcript for the vision observation
      if (data.description) {
        this.emit({
          type: "transcript",
          entry: {
            role: "agent",
            text: data.description,
            timestamp: Date.now(),
          },
        });
        // Keep context for continuity
        this.context.push({ role: "assistant", content: data.description });
        if (this.context.length > 12) {
          this.context = this.context.slice(-10);
        }
      }

      // Handle proactive suggestion
      if (data.proactive_suggestion) {
        const { text, confidence } = data.proactive_suggestion;
        if (text && typeof confidence === "number") {
          this.emit({ type: "proactive", text, confidence });
        }
      }

      // Process any tool calls from Gemini
      if (data.tool_calls && Array.isArray(data.tool_calls)) {
        for (const tc of data.tool_calls) {
          this.emit({
            type: "tool_call",
            call: {
              id: crypto.randomUUID(),
              name: tc.name,
              parameters: tc.parameters || {},
            },
          });

          // Execute client-side handler if registered
          const handler = this.toolHandlers[tc.name];
          if (handler) {
            try {
              await handler(tc.parameters || {});
            } catch (err) {
              console.error(`[GeminiVision] Tool "${tc.name}" failed:`, err);
            }
          }
        }
      }

      // Fire-and-forget shadow comparison if enabled
      if (currentSettings.shadowComparison) {
        this.fireShadowComparison(base64, currentSettings.isiZuluImmersion, data);
      }
    } catch (err) {
      console.error("[GeminiVision] Frame processing error:", err);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Fire-and-forget: send same frame to shadow models for comparison logging.
   * Never blocks the primary path. Failures are silently logged.
   */
  private async fireShadowComparison(
    frameBase64: string,
    isiZuluImmersion: boolean,
    primaryResult: any
  ): Promise<void> {
    try {
      const shadowResponse = await fetch("/api/vision-shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame_base64: frameBase64,
          isizulu_immersion: isiZuluImmersion,
          primary_result: {
            description: primaryResult.description,
            emotion: primaryResult.emotion,
            intensity: primaryResult.intensity,
          },
        }),
      });

      if (!shadowResponse.ok) {
        console.debug("[Shadow] Comparison failed:", shadowResponse.status);
        return;
      }

      const data = await shadowResponse.json();

      // Log comparison to session_logs via shadow logger
      shadowLog("shadow_comparison", {
        primary_model: data.primary_model,
        primary_description: data.primary_result?.description,
        shadow_results: data.shadow_results?.map((r: any) => ({
          model: r.model,
          latency: r.latency,
          description: r.result?.description,
          emotion: r.result?.emotion,
          isizulu_quality: r.result?.isizulu_quality,
          cultural_depth: r.result?.cultural_depth,
          error: r.error,
        })),
      });

      console.debug("[Shadow] Comparison logged:", data.shadow_results?.length, "models");
    } catch (err) {
      console.debug("[Shadow] Fire-and-forget error:", err);
    }
  }

  private async blobToBase64(frame: ImageData | Blob): Promise<string> {
    let blob: Blob;

    if (frame instanceof Blob) {
      blob = frame;
    } else {
      // ImageData → canvas → blob
      const canvas = new OffscreenCanvas(frame.width, frame.height);
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(frame, 0, 0);
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip data URL prefix
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private validateEmotion(raw: string): AvatarEmotion {
    const valid: AvatarEmotion[] = [
      "neutral", "thinking", "speaking", "listening", "alert", "empathetic",
    ];
    const lower = (raw || "neutral").toLowerCase() as AvatarEmotion;
    return valid.includes(lower) ? lower : "neutral";
  }
}
