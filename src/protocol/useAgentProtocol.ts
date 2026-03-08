/**
 * useAgentProtocol — React hook that binds a backend adapter to React state.
 *
 * The cockpit uses ONLY this hook. It never touches vendor SDKs.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AgentBackendAdapter,
  AvatarState,
  ConnectionStatus,
  ToolHandler,
  VoiceState,
} from "./types";

interface UseAgentProtocolReturn {
  status: ConnectionStatus;
  voiceState: VoiceState;
  avatarState: AvatarState;
  connect: (credentials: Record<string, unknown>, mediaStream?: MediaStream) => Promise<void>;
  disconnect: () => Promise<void>;
  setMicMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  registerTools: (tools: Record<string, ToolHandler>) => void;
  backendName: string;
}

export function useAgentProtocol(
  adapter: AgentBackendAdapter
): UseAgentProtocolReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isSpeaking: false,
    isListening: false,
    outputLevel: 0,
    inputLevel: 0,
  });
  const [avatarState, setAvatarState] = useState<AvatarState>({
    emotion: "neutral",
    intensity: 0,
  });

  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  useEffect(() => {
    const unsubscribe = adapter.on((event) => {
      switch (event.type) {
        case "status":
          setStatus(event.status);
          break;
        case "voice_state":
          setVoiceState({ ...event.state });
          break;
        case "avatar_state":
          setAvatarState({ ...event.state });
          break;
        case "error":
          console.error("[Agent Protocol] Backend error:", event.error);
          break;
      }
    });

    return () => {
      unsubscribe();
      adapter.destroy();
    };
  }, [adapter]);

  const connect = useCallback(
    async (credentials: Record<string, unknown>, mediaStream?: MediaStream) => {
      await adapterRef.current.connect({ credentials, mediaStream });
    },
    []
  );

  const disconnect = useCallback(async () => {
    await adapterRef.current.disconnect();
  }, []);

  const setMicMuted = useCallback((muted: boolean) => {
    adapterRef.current.setMicMuted(muted);
  }, []);

  const setVolume = useCallback((volume: number) => {
    adapterRef.current.setVolume(volume);
  }, []);

  const registerTools = useCallback((tools: Record<string, ToolHandler>) => {
    adapterRef.current.registerTools(tools);
  }, []);

  return {
    status,
    voiceState,
    avatarState,
    connect,
    disconnect,
    setMicMuted,
    setVolume,
    registerTools,
    backendName: adapter.name,
  };
}
