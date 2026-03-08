/**
 * ElevenLabs Adapter — Implements AgentBackendAdapter
 *
 * This is the ONLY file that imports @elevenlabs/react.
 * When the backend changes, write a new adapter — the cockpit stays the same.
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

export class ElevenLabsAdapter implements AgentBackendAdapter {
  readonly name = "ElevenLabs Conversational AI";

  private _status: ConnectionStatus = "disconnected";
  private _voiceState: VoiceState = {
    isSpeaking: false,
    isListening: false,
    outputLevel: 0,
    inputLevel: 0,
  };
  private _avatarState: AvatarState = {
    emotion: "neutral",
    intensity: 0,
  };
  private _vision: VisionCapabilities = { supportsVision: false };

  private handlers: Set<AgentEventHandler> = new Set();
  private conversation: any = null;
  private toolHandlers: Record<string, ToolHandler> = {};
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  get status() { return this._status; }
  get voiceState() { return this._voiceState; }
  get avatarState() { return this._avatarState; }
  get vision() { return this._vision; }

  private emit(event: Parameters<AgentEventHandler>[0]) {
    this.handlers.forEach((h) => h(event));
  }

  private updateStatus(status: ConnectionStatus) {
    this._status = status;
    this.emit({ type: "status", status });
  }

  private updateVoice(partial: Partial<VoiceState>) {
    this._voiceState = { ...this._voiceState, ...partial };
    this.emit({ type: "voice_state", state: this._voiceState });

    // Derive avatar emotion from voice state
    const emotion = this._voiceState.isSpeaking
      ? "speaking"
      : this._voiceState.isListening
        ? "listening"
        : "neutral";
    const intensity = this._voiceState.isSpeaking
      ? 0.8
      : this._voiceState.isListening
        ? 0.5
        : 0.2;
    this._avatarState = { emotion, intensity };
    this.emit({ type: "avatar_state", state: this._avatarState });
  }

  async connect(config: SessionConfig): Promise<void> {
    this.updateStatus("connecting");

    // Dynamically import ElevenLabs SDK — isolated to this adapter
    const { Conversation } = await import("@11labs/client");

    const signedUrl = config.credentials.signed_url as string;

    // Build client tools object for ElevenLabs
    const clientTools: Record<string, (params: any) => Promise<string>> = {};
    for (const [name, handler] of Object.entries(this.toolHandlers)) {
      clientTools[name] = async (params: any) => {
        const result = await handler(params);
        this.emit({
          type: "tool_call",
          call: { id: crypto.randomUUID(), name, parameters: params },
        });
        return result;
      };
    }

    this.conversation = await Conversation.startSession({
      signedUrl,
      clientTools: Object.keys(clientTools).length > 0 ? clientTools : undefined,
      onConnect: () => {
        this.updateStatus("connected");
        this.updateVoice({ isListening: true });
        this.startPolling();
      },
      onDisconnect: () => {
        this.stopPolling();
        this.updateVoice({ isSpeaking: false, isListening: false });
        this.updateStatus("disconnected");
      },
      onError: (error: any) => {
        console.error("[ElevenLabs Adapter] Error:", error);
        this.emit({ type: "error", error: String(error) });
      },
      onModeChange: (mode: { mode: string }) => {
        const isSpeaking = mode.mode === "speaking";
        this.updateVoice({
          isSpeaking,
          isListening: !isSpeaking,
        });
      },
    });
  }

  private startPolling() {
    this.pollInterval = setInterval(() => {
      if (this.conversation) {
        try {
          const inputVol = this.conversation.getInputVolume?.() ?? 0;
          const outputVol = this.conversation.getOutputVolume?.() ?? 0;
          this._voiceState.inputLevel = inputVol;
          this._voiceState.outputLevel = outputVol;
        } catch {
          // Methods may not exist on all SDK versions
        }
      }
    }, 100);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.conversation) {
      await this.conversation.endSession();
      this.conversation = null;
    }
    this.updateVoice({ isSpeaking: false, isListening: false, inputLevel: 0, outputLevel: 0 });
    this.updateStatus("disconnected");
  }

  setMicMuted(muted: boolean): void {
    if (this.conversation) {
      this.conversation.setVolume?.({ volume: muted ? 0 : 1 });
    }
  }

  setVolume(volume: number): void {
    if (this.conversation) {
      this.conversation.setVolume?.({ volume });
    }
  }

  on(handler: AgentEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  registerTools(tools: Record<string, ToolHandler>): void {
    this.toolHandlers = { ...this.toolHandlers, ...tools };
  }

  sendMessage(text: string): void {
    // ElevenLabs text-only mode not used in cockpit
    console.warn("[ElevenLabs Adapter] sendMessage not supported in voice mode");
  }

  destroy(): void {
    this.stopPolling();
    this.disconnect();
    this.handlers.clear();
  }
}
