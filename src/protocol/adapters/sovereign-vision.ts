/**
 * Sovereign Vision Adapter — Heritage-first vision reasoning.
 *
 * Drop-in replacement for GeminiVisionAdapter that routes ALL vision
 * frames through the sovereign-heritage edge function instead of
 * the standard vision-reasoning endpoint.
 *
 * Falls back to standard Gemini if sovereign endpoint fails or times out.
 */

import { supabase } from "@/integrations/supabase/client";
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

export class SovereignVisionAdapter implements AgentBackendAdapter {
  readonly name = "Sovereign Heritage Vision";

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

  private minFrameInterval = 6000;
  private backoffUntil = 0;
  private lastFrameTime = 0;
  private processing = false;

  // Timeout for sovereign endpoint before fallback
  private sovereignTimeoutMs = 10000;

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

  async connect(_config: SessionConfig): Promise<void> {
    this._status = "connected";
    this.context = [];
    this.emit({ type: "status", status: "connected" });
  }

  async disconnect(): Promise<void> {
    this._status = "disconnected";
    this.context = [];
    this.emit({ type: "status", status: "disconnected" });
  }

  setMicMuted(_muted: boolean): void {}
  setVolume(_volume: number): void {}

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
    if (now < this.backoffUntil) return;

    this.lastFrameTime = now;
    this.processing = true;

    try {
      const base64 = await this.blobToBase64(frame);
      const currentSettings = loadSettings();
      const memoryContext = currentSettings.memoryEnabled ? formatMemoriesForPrompt() : "";
      const goalsContext = currentSettings.memoryEnabled ? formatGoalsForPrompt() : "";

      const startTime = Date.now();
      let data: any = null;
      let usedSovereign = false;

      // Try sovereign endpoint first with timeout
      try {
        const sovereignPromise = supabase.functions.invoke("sovereign-heritage", {
          body: {
            frame_base64: base64,
            context: this.context,
            memory_context: memoryContext,
            goals_context: goalsContext,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Sovereign timeout")), this.sovereignTimeoutMs)
        );

        const result = await Promise.race([sovereignPromise, timeoutPromise]);
        const sovereignLatency = Date.now() - startTime;

        if (result.error) {
          throw new Error(result.error.message || "Sovereign error");
        }

        data = result.data;
        usedSovereign = true;

        // Log sovereign success
        shadowLog("sovereign_inference", {
          source: "sovereign-heritage",
          latency: sovereignLatency,
          emotion: data?.emotion,
          has_notes_zu: !!data?.notes_zu,
          has_sovereignty_signal: !!data?.sovereignty_signal,
        });

        console.debug(`[Sovereign] Heritage response in ${sovereignLatency}ms`);
      } catch (sovereignErr) {
        // Fallback to standard Gemini
        console.warn("[Sovereign] Falling back to Gemini:", (sovereignErr as Error).message);

        const { data: geminiData, error: geminiError } = await supabase.functions.invoke("vision-reasoning", {
          body: {
            frame_base64: base64,
            context: this.context,
            memory_context: memoryContext,
            goals_context: goalsContext,
            isizulu_immersion: true, // Always isiZulu in sovereign mode
          },
        });

        if (geminiError) {
          const msg = typeof geminiError === "object" && geminiError.message ? geminiError.message : String(geminiError);
          if (msg.includes("429") || msg.includes("Rate limit")) {
            this.backoffUntil = Date.now() + 30000;
            return;
          }
          this.emit({ type: "error", error: msg });
          return;
        }

        data = geminiData;

        shadowLog("sovereign_fallback", {
          reason: (sovereignErr as Error).message,
          fallback_latency: Date.now() - startTime,
        });
      }

      if (!data) return;

      // Update avatar state
      const emotion = this.validateEmotion(data.emotion);
      const intensity = Math.max(0, Math.min(1, data.intensity ?? 0.5));
      const label = data.description + (data.notes_zu ? ` — ${data.notes_zu}` : "");
      this._avatarState = { emotion, intensity, label };
      this.emit({ type: "avatar_state", state: this._avatarState });

      // Emit transcript
      if (data.description) {
        const sourceTag = usedSovereign ? " ⚡" : "";
        this.emit({
          type: "transcript",
          entry: {
            role: "agent",
            text: data.description + sourceTag,
            timestamp: Date.now(),
          },
        });
        this.context.push({ role: "assistant", content: data.description });
        if (this.context.length > 12) {
          this.context = this.context.slice(-10);
        }
      }

      // Proactive suggestion
      if (data.proactive_suggestion) {
        const { text, confidence } = data.proactive_suggestion;
        if (text && typeof confidence === "number") {
          this.emit({ type: "proactive", text, confidence });
        }
      }

      // Tool calls
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

          const handler = this.toolHandlers[tc.name];
          if (handler) {
            try {
              await handler(tc.parameters || {});
            } catch (err) {
              console.error(`[Sovereign] Tool "${tc.name}" failed:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Sovereign] Frame processing error:", err);
    } finally {
      this.processing = false;
    }
  }

  private async blobToBase64(frame: ImageData | Blob): Promise<string> {
    let blob: Blob;
    if (frame instanceof Blob) {
      blob = frame;
    } else {
      const canvas = new OffscreenCanvas(frame.width, frame.height);
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(frame, 0, 0);
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
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
