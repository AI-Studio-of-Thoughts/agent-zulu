# Agent Zulu Protocol — Technical Architecture

> See [README.md](./README.md) for mission, vision, and high-level architecture.

This document covers implementation details for developers.

---

## Protocol Layer (`src/protocol/`)

### `types.ts` — The Contract

The `AgentBackendAdapter` interface is the **only** dependency boundary between the cockpit and any AI backend. It defines:

```typescript
interface AgentBackendAdapter {
  readonly name: string;
  readonly status: ConnectionStatus;
  readonly voiceState: VoiceState;       // isSpeaking, isListening, levels
  readonly avatarState: AvatarState;     // emotion, intensity
  readonly vision: VisionCapabilities;   // supportsVision, sendFrame()

  connect(config: SessionConfig): Promise<void>;
  disconnect(): Promise<void>;
  setMicMuted(muted: boolean): void;
  setVolume(volume: number): void;
  on(handler: AgentEventHandler): () => void;
  registerTools(tools: Record<string, ToolHandler>): void;
  destroy(): void;
}
```

### Event System

Adapters emit `AgentEvent` objects:
- `voice_state` — speaking/listening changes, audio levels
- `avatar_state` — emotion and intensity for avatar animations
- `transcript` — user and agent speech text
- `tool_call` — backend requests client-side action
- `error` — error messages
- `status` — connection state changes

### `useAgentProtocol.ts` — React Binding

Converts adapter events into React state. Components use this hook exclusively.

### `adapters/elevenlabs.ts` — Current Backend

- Uses `@11labs/client` `Conversation.startSession()`
- Maps ElevenLabs `onModeChange` to protocol `VoiceState`
- Derives `AvatarState` from voice state (speaking → speaking emotion, etc.)
- Polls `getInputVolume()` / `getOutputVolume()` for real-time levels

---

## Edge Function

### `elevenlabs-conversation-token`

- Reads `ELEVENLABS_API_KEY` from secrets
- Fetches signed WebSocket URL from ElevenLabs API
- Agent ID: `agent_2501kk6wt2eneyysjqpsh1jyff15`
- Returns `{ signed_url }` to frontend

---

## Writing a New Adapter

```typescript
// src/protocol/adapters/sovereign.ts
import type { AgentBackendAdapter, ... } from "../types";

export class SovereignModelAdapter implements AgentBackendAdapter {
  readonly name = "Sovereign Frontier Model";
  // ... implement all interface methods
}
```

Then in `AgentInterface.tsx`, change one line:
```typescript
const adapter = useMemo(() => new SovereignModelAdapter(), []);
```

---

## Design Tokens

All in `src/index.css` as HSL CSS variables. Referenced via Tailwind config. Never use raw color values in components.

## Secrets

| Secret | Purpose |
|--------|---------|
| `ELEVENLABS_API_KEY` | ElevenLabs API access (edge function only) |

All secrets are managed through Lovable Cloud. Never in client code.
