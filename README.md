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
| Backend | Lovable Cloud (backend function + secrets) |
| Fonts | Orbitron (display), Inter (body), JetBrains Mono (monospace) |

---

## Architecture Diagram

```text
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
│  Backend Function                    │
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

## What Was Implemented

### 1) ElevenLabs SDK integration
- Added dependency: `@elevenlabs/react`
- `AgentInterface.tsx` now uses `useConversation()` for real-time conversational voice.

### 2) Real session lifecycle in UI
- Start button requests permissions, gets signed URL, starts session.
- End button terminates session and stops local media tracks.
- Session state now comes from SDK status (`connected`/`disconnected`) and speaking state.

### 3) Secure backend function for signed URL
- Added: `supabase/functions/elevenlabs-conversation-token/index.ts`
- Function reads `ELEVENLABS_API_KEY` secret and requests signed URL from ElevenLabs for:
  - `agent_2501kk6wt2eneyysjqpsh1jyff15`
- Frontend calls this function before starting session.

### 4) Existing UI components retained and wired to real state
- `AvatarDisplay`: reacts to `isSpeaking` / `isListening` / `isConnected`
- `ConnectionStatus`: shows connection state + session timer
- `MicIndicator`: local mic toggle and level bars
- `CameraPreview`: local PiP camera feed if video permission granted

---

## Key Components

### `src/components/AgentInterface.tsx`
**Main orchestrator.** Handles:
1. Permission request (`getUserMedia`)
2. Backend signed URL request
3. `conversation.startSession({ signedUrl })`
4. Session end cleanup
5. Feeding speaking/listening/connection state to UI

**Important state:**
- `conversation.status` — `"connected"` | `"disconnected"`
- `conversation.isSpeaking` — used for speaking animations
- `isListening` — derived as connected + not speaking

### `src/components/AvatarDisplay.tsx`
- Animated agent visual
- Pulsing glow while connected
- Speaking/listening status labels

### `src/components/MicIndicator.tsx`
- Mic mute/unmute toggle
- Realtime bar visualization using `AudioContext` + `AnalyserNode`

### `src/components/CameraPreview.tsx`
- Shows user camera stream if available
- Fallback icon when camera inactive/unavailable

### `src/components/ConnectionStatus.tsx`
- Connected/disconnected badge
- Live session timer (MM:SS)

---

## Backend Function

### `supabase/functions/elevenlabs-conversation-token/index.ts`

**Purpose:** Keep API keys secure and return a signed URL to the frontend.

**Flow:**
1. Request arrives from app
2. Read `ELEVENLABS_API_KEY` from secrets
3. Call ElevenLabs:
   - `GET /v1/convai/conversation/get-signed-url?agent_id={AGENT_ID}`
4. Return `{ signed_url }`

**Secret used:**
- `ELEVENLABS_API_KEY` (already configured)

---

## Session Flow

```text
[Start Screen]
    │
    ▼ User taps power
[Request mic/camera permissions]
    │
    ▼
[Call backend function for signed URL]
    │
    ▼
[conversation.startSession({ signedUrl })]
    │
    ▼
[Live voice conversation]
    │
    ▼ User taps end
[conversation.endSession + stop media tracks]
    │
    ▼
[Return to Start Screen]
```

---

## Design System Notes

Theme is token-driven from `src/index.css` (HSL semantic tokens), including:
- `--background`, `--foreground`
- `--primary`, `--accent`
- `--muted-foreground`, `--destructive`

Utility classes used heavily:
- `.glass-surface`
- `.glow-ring`, `.glow-ring-lg`
- `.text-glow`

Typography:
- Display: Orbitron
- Body: Inter
- Mono: JetBrains Mono

---

## Files Added/Changed

### Added
- `supabase/functions/elevenlabs-conversation-token/index.ts`
- `ARCHITECTURE.md` (mirror handoff doc)

### Changed
- `src/components/AgentInterface.tsx`
- `package.json` (dependency added)
- `README.md` (this handoff documentation)

---

## Notes for Co-dev

1. **Agent behavior is configured in ElevenLabs dashboard**, not in app code.
2. Current agent wired in backend function:
   - `agent_2501kk6wt2eneyysjqpsh1jyff15`
3. If changing to another agent ID, update backend function constant.
4. API key remains server-side only (good security posture).

---

## Suggested Next Iterations

- Add live transcript panel (user + agent utterances)
- Add output volume slider
- Add conversation history persistence
- Add multi-agent picker
- Add robust error UX (toasts, retry states, permission guidance)
