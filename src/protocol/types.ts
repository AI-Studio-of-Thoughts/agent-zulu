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

// ── Reflection ──────────────────────────────────────────────

export interface ReflectionOverlayItem {
  type: "proverb" | "cultural_insight" | "goal_update" | "community_echo";
  /** Normalized 0-1 coords for AR placement (optional) */
  x?: number;
  y?: number;
  /** Primary label in African language */
  label: string;
  /** English gloss */
  label_en?: string;
}

export interface ReflectionEvent {
  /** isiZulu-first summary of the session's cultural arc */
  summary: string;
  /** English summary */
  summary_en?: string;
  /** Relevant proverb (isaga/methali/òwe) */
  proverb: string;
  /** Goal update suggestion */
  goal_update?: string;
  /** AR overlay items to render on camera feed */
  overlays: ReflectionOverlayItem[];
  /** Community echo from ubuntu flywheel */
  community_echo?: string;
  /** Source identifier */
  source?: string;
  /** Generative isiZulu poem/praise line from the session */
  generated_poem_isizulu?: string;
  /** Optional image generation prompt for AR visual */
  generated_image_prompt?: string;
  /** Predicted next goal */
  predicted_next_goal?: string;
  /** Prediction confidence 0-1 */
  prediction_confidence?: number;
  /** isiZulu suggestion for predicted goal */
  isizulu_suggestion?: string;
}

export type AgentEvent =
  | { type: "voice_state"; state: VoiceState }
  | { type: "avatar_state"; state: AvatarState }
  | { type: "transcript"; entry: TranscriptEntry }
  | { type: "tool_call"; call: ToolCall }
  | { type: "proactive"; text: string; confidence: number }
  | { type: "gesture"; gesture: GestureDetected }
  | { type: "reflection"; reflection: ReflectionEvent }
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
