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
  GestureDetected,
  ReflectionEvent,
  ReflectionOverlayItem,
  SessionConfig,
  ToolCall,
  ToolHandler,
  TranscriptEntry,
  VisionCapabilities,
  VoiceState,
} from "./types";

export { useAgentProtocol } from "./useAgentProtocol";
export { HybridAdapter } from "./adapters/hybrid";
export { SovereignBetaAdapter } from "./adapters/sovereign-beta";
