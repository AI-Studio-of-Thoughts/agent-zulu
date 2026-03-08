/**
 * Agent Zulu Protocol — Public API
 *
 * Import from here. Never import vendor adapters directly from components.
 */

export type {
  AgentBackendAdapter,
  AgentEvent,
  AgentEventHandler,
  AvatarEmotion,
  AvatarState,
  ConnectionStatus,
  SessionConfig,
  ToolCall,
  ToolHandler,
  TranscriptEntry,
  VisionCapabilities,
  VoiceState,
} from "./types";

export { useAgentProtocol } from "./useAgentProtocol";
export { ElevenLabsAdapter } from "./adapters/elevenlabs";
export { GeminiVisionAdapter } from "./adapters/gemini-vision";
export { HybridAdapter } from "./adapters/hybrid";
