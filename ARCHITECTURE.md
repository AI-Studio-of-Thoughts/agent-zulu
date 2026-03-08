# Agent Zulu — Architecture & Implementation Guide

## Overview

Agent Zulu is a real-time voice conversational AI interface built with React + TypeScript. It connects to an **ElevenLabs Conversational AI Agent** via WebSocket, enabling full-duplex voice conversations with an AI agent directly in the browser.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, Framer Motion |
| UI Components | shadcn/ui (Radix primitives) |
| Voice Engine | ElevenLabs Conversational AI SDK (`@elevenlabs/react`) |
| Backend | Lovable Cloud (Edge Functions, Secrets Management) |
| Fonts | Orbitron (display), Inter (body), JetBrains Mono (monospace) |

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│           Browser (React)           │
│                                     │
│  AgentInterface                     │
│  ├── useConversation() hook         │
│  │   └── WebSocket ↔ ElevenLabs    │
│  ├── AvatarDisplay (visual state)   │
│  ├── MicIndicator (audio levels)    │
│  ├── CameraPreview (video feed)     │
│  └── ConnectionStatus (timer/wifi)  │
└──────────────┬──────────────────────┘
               │ fetch signed URL
               ▼
┌──────────────────────────────────────┐
│  Edge Function                       │
│  elevenlabs-conversation-token       │
│  └── GET /v1/convai/conversation/    │
│      get-signed-url?agent_id=...     │
│      (uses ELEVENLABS_API_KEY)       │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  ElevenLabs Conversational AI API    │
│  Agent ID: agent_2501kk6wt2ene...   │
└──────────────────────────────────────┘
```

---

## Key Components

### `src/components/AgentInterface.tsx`
**Main orchestrator.** Manages session lifecycle:
1. User taps power button → requests mic/camera permissions
2. Calls edge function to get a **signed WebSocket URL**
3. Starts ElevenLabs conversation via `useConversation()` hook
4. SDK handles all audio I/O (mic capture + agent playback)
5. Exposes `isSpeaking` / `status` for reactive UI updates

**Key state:**
- `conversation.status` — `"connected"` | `"disconnected"`
- `conversation.isSpeaking` — drives avatar animations
- `isListening` — derived: connected && !speaking

### `src/components/AvatarDisplay.tsx`
Displays the agent avatar with reactive visual feedback:
- Pulsing glow rings when connected
- Faster pulse when agent is speaking
- Scan line effect overlay
- Status label: Speaking / Listening / Standby / Offline

### `src/components/MicIndicator.tsx`
Bottom-left mic button with real-time audio level bars:
- Creates `AudioContext` + `AnalyserNode` from media stream
- Renders 5 animated bars reflecting mic input level
- Toggle to mute/unmute

### `src/components/CameraPreview.tsx`
Bottom-right picture-in-picture camera feed:
- Shows live video if camera permission granted
- Falls back to `VideoOff` icon if no camera

### `src/components/ConnectionStatus.tsx`
Top-left status bar:
- Green pulsing dot + "Connected" / Red dot + "Disconnected"
- Session duration timer (MM:SS)

---

## Edge Function

### `supabase/functions/elevenlabs-conversation-token/index.ts`

**Purpose:** Securely generate a signed WebSocket URL without exposing the API key to the client.

**Flow:**
1. Receives request from frontend
2. Reads `ELEVENLABS_API_KEY` from secrets
3. Calls `GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={AGENT_ID}`
4. Returns `{ signed_url: "wss://..." }` to the client

**Secrets required:**
| Secret | Description |
|--------|-------------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key (stored in Lovable Cloud secrets) |

The agent ID (`agent_2501kk6wt2eneyysjqpsh1jyff15`) is hardcoded in the edge function.

---

## Design System

### Color Palette (HSL tokens in `src/index.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `220 30% 5%` | Dark base |
| `--foreground` | `190 100% 95%` | Light text |
| `--primary` | `185 100% 50%` | Cyan accent (glows, borders, active states) |
| `--accent` | `260 80% 60%` | Purple secondary accent |
| `--muted-foreground` | `210 15% 50%` | Subdued text |
| `--destructive` | `0 70% 50%` | Error/end states |

### Custom Utilities
- `.glass-surface` — frosted glass card effect
- `.glow-ring` / `.glow-ring-lg` — cyan box-shadow glows
- `.text-glow` — cyan text-shadow

### Typography
- **Display:** Orbitron (futuristic, all-caps headers)
- **Body:** Inter (clean readability)
- **Mono:** JetBrains Mono (status labels, timers)

---

## Session Flow

```
[Start Screen]
    │
    ▼ User taps power button
[Request Permissions]
    │ getUserMedia({ audio, video })
    ▼
[Fetch Signed URL]
    │ supabase.functions.invoke("elevenlabs-conversation-token")
    ▼
[Start ElevenLabs Session]
    │ conversation.startSession({ signedUrl })
    ▼
[Connected — Live Conversation]
    │ SDK handles mic input → agent → speaker output
    │ UI reacts to isSpeaking / status
    ▼
[User taps end]
    │ conversation.endSession()
    │ Stop media tracks
    ▼
[Back to Start Screen]
```

---

## ElevenLabs Agent Configuration

The voice agent behavior (personality, system prompt, voice, language, tools) is configured **in the ElevenLabs dashboard**, not in code:
- Dashboard: https://elevenlabs.io/app/conversational-ai
- Agent ID: `agent_2501kk6wt2eneyysjqpsh1jyff15`

Changes to agent behavior (prompt, voice, first message, etc.) are made in the ElevenLabs UI and take effect immediately — no code deploy needed.

---

## File Structure

```
src/
├── components/
│   ├── AgentInterface.tsx      # Main session orchestrator
│   ├── AvatarDisplay.tsx       # Agent avatar with animations
│   ├── CameraPreview.tsx       # PiP camera feed
│   ├── ConnectionStatus.tsx    # Status bar + timer
│   ├── MicIndicator.tsx        # Mic toggle + audio bars
│   └── NavLink.tsx             # Navigation component
├── assets/
│   └── agent-avatar.png        # Agent avatar image
├── pages/
│   ├── Index.tsx                # Main page (renders AgentInterface)
│   └── NotFound.tsx             # 404 page
├── index.css                    # Design tokens + global styles
└── App.tsx                      # Router setup

supabase/
└── functions/
    └── elevenlabs-conversation-token/
        └── index.ts             # Signed URL generator
```

---

## Development Notes

### Running Locally
```bash
npm install
npm run dev
```

### Environment
All secrets are managed through Lovable Cloud. No `.env` editing needed for production secrets. The `.env` file only contains public Lovable Cloud connection details.

### Deployment
- **Frontend:** Click "Publish" → "Update" in Lovable
- **Edge Functions:** Deploy automatically on save

### Modifying the Agent
To change the AI agent's behavior, voice, or prompt:
1. Go to https://elevenlabs.io/app/conversational-ai
2. Select the agent
3. Edit prompt, voice, first message, tools, etc.
4. Changes are live immediately

---

## Future Enhancements (Ideas)
- [ ] Live conversation transcript display
- [ ] Volume control for agent output
- [ ] Client tools (agent triggers UI actions)
- [ ] Conversation history persistence (database)
- [ ] Multiple agent selection
