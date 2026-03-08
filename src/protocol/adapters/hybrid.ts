/**
 * HybridAdapter — Merges ElevenLabs voice + Gemini vision into one adapter.
 *
 * Voice (STT/TTS/conversation): ElevenLabs (low-latency)
 * Vision (perception/reasoning): Gemini (multimodal)
 *
 * The cockpit sees a single AgentBackendAdapter. Internally, events
 * from both backends are merged, with vision avatar states blended
 * when the voice agent isn't actively speaking.
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
import { GeminiVisionAdapter } from "./gemini-vision";

export class HybridAdapter implements AgentBackendAdapter {
  readonly name = "Hybrid (ElevenLabs Voice + Gemini Vision)";

  private voice: ElevenLabsAdapter;
  private vision_adapter: GeminiVisionAdapter;
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
    this.vision_adapter = new GeminiVisionAdapter();
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

    // Subscribe to voice events
    this.voiceUnsub = this.voice.on((event) => {
      switch (event.type) {
        case "status":
          // Voice drives primary connection status
          this._status = event.status;
          this.emit(event);
          // When voice connects, also connect vision
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
          // When speaking, voice avatar takes priority
          this.resolveAvatarState();
          break;
        case "avatar_state":
          // Voice-derived avatar — merge with vision
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

    // Subscribe to vision events
    this.visionUnsub = this.vision_adapter.on((event) => {
      switch (event.type) {
        case "avatar_state":
          // Store vision avatar; use it when voice is idle
          this._visionAvatarState = event.state;
          this.resolveAvatarState();
          break;
        case "transcript":
          // Vision observations go to transcript
          this.emit(event);
          break;
        case "tool_call":
          this.emit(event);
          break;
        case "error":
          this.emit(event);
          break;
        // Ignore vision status events — voice drives status
      }
    });

    // Connect voice (primary)
    await this.voice.connect(config);
  }

  /**
   * When voice is speaking → use voice avatar state.
   * When idle → use vision avatar state (perception-driven emotion).
   */
  private resolveAvatarState() {
    if (this._voiceState.isSpeaking) {
      this._avatarState = { emotion: "speaking", intensity: 0.8 };
    } else if (this._voiceState.isListening) {
      // Blend: if vision has something interesting, show it; else show listening
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
    // Register on both — voice tools go to ElevenLabs, vision tools to Gemini
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
