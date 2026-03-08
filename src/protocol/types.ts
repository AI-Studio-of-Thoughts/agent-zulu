/**
 * Agent Zulu Protocol — The Interface Contract
 *
 * Any backend (ElevenLabs, sovereign model, frontier cluster)
 * must implement AgentBackendAdapter to power the cockpit.
 * The frontend NEVER imports vendor SDKs directly.
 */

// ── Connection ──────────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface SessionConfig {
  /** Opaque credentials from the token edge function */
  credentials: Record<string, unknown>;
  /** Media stream for mic/camera */
  mediaStream?: MediaStream;
}

// ── Voice ───────────────────────────────────────────────────

export interface VoiceState {
  /** Is the agent currently speaking? */
  isSpeaking: boolean;
  /** Is the agent currently listening to user input? */
  isListening: boolean;
  /** Agent output audio level 0-1 */
  outputLevel: number;
  /** User input audio level 0-1 */
  inputLevel: number;
}

// ── Vision ──────────────────────────────────────────────────

export interface VisionCapabilities {
  /** Can the backend accept camera frames? */
  supportsVision: boolean;
  /** Send a camera frame to the backend */
  sendFrame?: (frame: ImageData | Blob) => void;
}

// ── Avatar State ────────────────────────────────────────────

export type AvatarEmotion =
  | "neutral"
  | "thinking"
  | "speaking"
  | "listening"
  | "alert"
  | "empathetic";

export interface AvatarState {
  emotion: AvatarEmotion;
  /** Intensity 0-1 for animation strength */
  intensity: number;
  /** Optional text label from backend */
  label?: string;
}

// ── Tool / Action Triggers ──────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export type ToolHandler = (
  params: Record<string, unknown>
) => string | Promise<string>;

// ── Transcript ──────────────────────────────────────────────

export interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  timestamp: number;
  /** If this was a correction (agent interrupted) */
  corrected?: boolean;
}

// ── Events (Backend → Frontend) ─────────────────────────────

export interface GestureDetected {
  type: "hand_offer" | "point" | "wave" | "hold_up" | "open_palm";
  x: number;
  y: number;
  label_zu: string;
  label_en?: string;
  confidence: number;
}

export type AgentEvent =
  | { type: "voice_state"; state: VoiceState }
  | { type: "avatar_state"; state: AvatarState }
  | { type: "transcript"; entry: TranscriptEntry }
  | { type: "tool_call"; call: ToolCall }
  | { type: "proactive"; text: string; confidence: number }
  | { type: "gesture"; gesture: GestureDetected }
  | { type: "error"; error: string }
  | { type: "status"; status: ConnectionStatus };

export type AgentEventHandler = (event: AgentEvent) => void;

// ── The Adapter Interface ───────────────────────────────────

export interface AgentBackendAdapter {
  /** Human-readable name for this backend */
  readonly name: string;

  /** Current connection status */
  readonly status: ConnectionStatus;

  /** Current voice state */
  readonly voiceState: VoiceState;

  /** Current avatar state */
  readonly avatarState: AvatarState;

  /** Vision capabilities */
  readonly vision: VisionCapabilities;

  /** Start a session with the given config */
  connect(config: SessionConfig): Promise<void>;

  /** End the current session */
  disconnect(): Promise<void>;

  /** Mute/unmute user microphone */
  setMicMuted(muted: boolean): void;

  /** Set agent output volume (0-1) */
  setVolume(volume: number): void;

  /** Register an event handler */
  on(handler: AgentEventHandler): () => void;

  /** Register client-side tool handlers */
  registerTools(tools: Record<string, ToolHandler>): void;

  /** Send a text message (for hybrid interfaces) */
  sendMessage?(text: string): void;

  /** Clean up all resources */
  destroy(): void;
}
