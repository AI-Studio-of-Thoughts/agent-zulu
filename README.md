# Agent Zulu

## Mission

Agent Zulu is the sovereign, real-time multimodal interface layer for a future frontier-scale African AI system. It is not the model — it is the **cockpit**. Its purpose is to give humans a natural, continuous, camera-first and voice-first way to interact with advanced AI systems without typing, screens of text, or chat paradigms.

## Vision

Agent Zulu provides a **consistent human experience** while the intelligence behind it evolves. The interface stays the same — the backend can change from ElevenLabs to a sovereign, frontier-level, African-governed intelligence without changing the UI contract.

The user always experiences:
- Real-time voice conversation
- Camera-based perception
- Embodied presence through an avatar
- Continuous, natural interaction
- Zero text, zero friction

As the backend grows in capability, Agent Zulu becomes the gateway to a **sovereign African cognitive infrastructure** — the first point of contact between people and the Second Intelligence.

---

## Architectural Principle: Decouple the Cockpit from the Engine

```
┌─────────────────────────────────────────┐
│  Frontend — THE COCKPIT                 │
│  UI · Camera · Mic · Avatar · Protocol  │
│                                         │
│  AgentInterface (orchestrator)          │
│  └── useAgentProtocol(adapter)          │
│       ├── AvatarDisplay                 │
│       ├── MicIndicator                  │
│       ├── CameraPreview                 │
│       └── ConnectionStatus              │
└──────────────┬──────────────────────────┘
               │ Agent Zulu Protocol
               │ (types.ts interface contract)
               ▼
┌──────────────────────────────────────────┐
│  Backend Adapter (swappable)             │
│                                          │
│  Today:  ElevenLabsAdapter               │
│  Future: SovereignModelAdapter           │
│          FrontierClusterAdapter          │
│          DistributedMeshAdapter          │
└──────────────────────────────────────────┘
```

### The Protocol Contract (`src/protocol/types.ts`)

Any backend must implement `AgentBackendAdapter`:

| Capability | Interface | Description |
|-----------|-----------|-------------|
| **Voice** | `VoiceState` | Bidirectional speech: `isSpeaking`, `isListening`, `inputLevel`, `outputLevel` |
| **Vision** | `VisionCapabilities` | Camera frame ingestion: `supportsVision`, `sendFrame()` |
| **Avatar** | `AvatarState` | Emotion-driven UI: `emotion`, `intensity`, `label` |
| **Tools** | `ToolCall` / `ToolHandler` | Backend triggers client-side actions |
| **Lifecycle** | `connect()` / `disconnect()` / `destroy()` | Session management |

### Swapping Backends

To connect a new AI engine:
1. Create `src/protocol/adapters/your-engine.ts`
2. Implement `AgentBackendAdapter`
3. Change one line in `AgentInterface.tsx`: `new YourEngineAdapter()`
4. **Zero UI changes. Zero protocol changes.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, Framer Motion |
| Protocol | Agent Zulu Protocol (`src/protocol/`) |
| Current Backend | ElevenLabs Conversational AI (`@11labs/client`) |
| Backend Functions | Lovable Cloud (Edge Functions, Secrets) |
| Fonts | Orbitron (display), Inter (body), JetBrains Mono (mono) |

---

## File Structure

```
src/
├── protocol/                    # ← THE PROTOCOL LAYER
│   ├── types.ts                 # Interface contract (backend-agnostic)
│   ├── useAgentProtocol.ts      # React hook binding adapter → state
│   ├── index.ts                 # Public API
│   └── adapters/
│       └── elevenlabs.ts        # Current backend adapter
├── components/
│   ├── AgentInterface.tsx       # Cockpit orchestrator
│   ├── AvatarDisplay.tsx        # Emotion-driven avatar
│   ├── CameraPreview.tsx        # PiP camera feed
│   ├── ConnectionStatus.tsx     # Status bar + timer
│   └── MicIndicator.tsx         # Mic toggle + audio bars
├── assets/
│   └── agent-avatar.png
├── pages/
│   ├── Index.tsx
│   └── NotFound.tsx
└── index.css                    # Design tokens

supabase/functions/
└── elevenlabs-conversation-token/
    └── index.ts                 # Signed URL generator (keep API key server-side)
```

---

## Session Flow

```
[Start Screen]
    │
    ▼ User taps power
[Request mic/camera permissions]
    │
    ▼
[Fetch credentials from backend function]
    │
    ▼
[adapter.connect(credentials)]  ← Protocol call, not vendor call
    │
    ▼
[Live voice conversation]
    │ Protocol emits: voice_state, avatar_state events
    │ Cockpit reacts with animations, status, emotion
    ▼
[User taps end]
    │
[adapter.disconnect()]
    │
    ▼
[Return to Start Screen]
```

---

## Design System

### Tokens (HSL in `src/index.css`)
- `--background`: Dark base (220 30% 5%)
- `--primary`: Cyan accent (185 100% 50%)
- `--accent`: Purple secondary (260 80% 60%)
- `--destructive`: Alert red (0 70% 50%)

### Utilities
- `.glass-surface` — frosted glass panels
- `.glow-ring` / `.glow-ring-lg` — cyan glow effects
- `.text-glow` — cyan text shadow

### Typography
- **Display:** Orbitron (futuristic headers)
- **Body:** Inter (readability)
- **Mono:** JetBrains Mono (status, timers)

---

## Backend Function

`supabase/functions/elevenlabs-conversation-token/index.ts`

Securely fetches a signed WebSocket URL from ElevenLabs. API key stays server-side.

**Secret:** `ELEVENLABS_API_KEY` (configured in Lovable Cloud)
**Agent ID:** `agent_2501kk6wt2eneyysjqpsh1jyff15` (hardcoded in function)

---

## Future Evolution

- [ ] Vision adapter: send camera frames to backend for perception
- [ ] Live transcript panel (user + agent utterances)
- [ ] Sovereign model adapter (replace ElevenLabs)
- [ ] Tool triggers: backend controls client UI actions
- [ ] Conversation history persistence
- [ ] Multi-agent selection
- [ ] Distributed mesh adapter for frontier cluster
