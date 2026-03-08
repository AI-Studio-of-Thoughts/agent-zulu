/**
 * SovereignBetaAdapter — The first sovereign intelligence path.
 *
 * Identical to HybridAdapter (ElevenLabs voice + vision) but swaps
 * the vision backend from GeminiVisionAdapter to SovereignVisionAdapter.
 *
 * SovereignVisionAdapter routes frames to the sovereign-heritage edge
 * function (isiZulu-first, culturally deep reasoning) with automatic
 * fallback to standard Gemini if sovereign fails or times out.
 *
 * Toggle "Sovereign Beta" in Settings to activate.
 */

import type {
  AgentBackendAdapter,
  AgentEventHandler,
  AvatarState,
  ConnectionStatus,
  SessionConfig,
  ToolHandler,
  VisionCapabilities,
  VoiceState,
} from "../types";
import { ElevenLabsAdapter } from "./elevenlabs";
import { SovereignVisionAdapter } from "./sovereign-vision";

export class SovereignBetaAdapter implements AgentBackendAdapter {
  readonly name = "Sovereign Beta (ElevenLabs Voice + Heritage Vision)";

  private voice: ElevenLabsAdapter;
  private vision_adapter: SovereignVisionAdapter;
  private handlers = new Set<AgentEventHandler>();

  private _status: ConnectionStatus = "disconnected";
  private _voiceState: VoiceState = {
    isSpeaking: false,
    isListening: false,
    outputLevel: 0,
    inputLevel: 0,
  };
  private _avatarState: AvatarState = { emotion: "neutral", intensity: 0 };
  private _visionAvatarState: AvatarState = { emotion: "neutral", intensity: 0.2 };

  private voiceUnsub: (() => void) | null = null;
  private visionUnsub: (() => void) | null = null;

  constructor() {
    this.voice = new ElevenLabsAdapter();
    this.vision_adapter = new SovereignVisionAdapter();
  }

  get status() { return this._status; }
  get voiceState() { return this._voiceState; }
  get avatarState() { return this._avatarState; }

  get vision(): VisionCapabilities {
    return this.vision_adapter.vision;
  }

  private emit(event: Parameters<AgentEventHandler>[0]) {
    this.handlers.forEach((h) => h(event));
  }

  async connect(config: SessionConfig): Promise<void> {
    this._status = "connecting";
    this.emit({ type: "status", status: "connecting" });

    this.voiceUnsub = this.voice.on((event) => {
      switch (event.type) {
        case "status":
          this._status = event.status;
          this.emit(event);
          if (event.status === "connected") {
            this.vision_adapter.connect({ credentials: {} }).catch(console.error);
          }
          if (event.status === "disconnected") {
            this.vision_adapter.disconnect().catch(console.error);
          }
          break;
        case "voice_state":
          this._voiceState = event.state;
          this.emit(event);
          this.resolveAvatarState();
          break;
        case "avatar_state":
          if (this._voiceState.isSpeaking) {
            this._avatarState = event.state;
            this.emit({ type: "avatar_state", state: this._avatarState });
          }
          break;
        case "transcript":
        case "tool_call":
        case "error":
          this.emit(event);
          break;
      }
    });

    this.visionUnsub = this.vision_adapter.on((event) => {
      switch (event.type) {
        case "avatar_state":
          this._visionAvatarState = event.state;
          this.resolveAvatarState();
          break;
        case "transcript":
        case "tool_call":
          this.emit(event);
          break;
        case "proactive":
          if (!this._voiceState.isSpeaking) {
            this.emit(event);
          }
          break;
        case "error":
          this.emit(event);
          break;
      }
    });

    await this.voice.connect(config);
  }

  private resolveAvatarState() {
    if (this._voiceState.isSpeaking) {
      this._avatarState = { emotion: "speaking", intensity: 0.8 };
    } else if (this._voiceState.isListening) {
      if (
        this._visionAvatarState.emotion !== "neutral" &&
        this._visionAvatarState.intensity > 0.4
      ) {
        this._avatarState = this._visionAvatarState;
      } else {
        this._avatarState = { emotion: "listening", intensity: 0.5 };
      }
    } else {
      this._avatarState = this._visionAvatarState;
    }
    this.emit({ type: "avatar_state", state: this._avatarState });
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.voice.disconnect(),
      this.vision_adapter.disconnect(),
    ]);
  }

  setMicMuted(muted: boolean): void {
    this.voice.setMicMuted(muted);
  }

  setVolume(volume: number): void {
    this.voice.setVolume(volume);
  }

  on(handler: AgentEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  registerTools(tools: Record<string, ToolHandler>): void {
    this.voice.registerTools(tools);
    this.vision_adapter.registerTools(tools);
  }

  sendMessage(text: string): void {
    this.voice.sendMessage?.(text);
    this.vision_adapter.sendMessage?.(text);
  }

  destroy(): void {
    this.voiceUnsub?.();
    this.visionUnsub?.();
    this.voice.destroy();
    this.vision_adapter.destroy();
    this.handlers.clear();
  }
}
