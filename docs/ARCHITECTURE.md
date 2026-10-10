# LivePersona — Architecture

```
┌──────────────────┐     HTTP / SSE      ┌────────────────────┐
│  Web (React)     │ ◄─────────────────► │  Server (Express)  │
│  STT/TTS browser │                     │  LLM proxy         │
│  Avatar render   │                     │  Optional logs     │
└────────┬─────────┘                     └─────────┬──────────┘
         │                                         │
         ▼                                         ▼
┌──────────────────┐                     ┌────────────────────┐
│ @livepersona/core│                     │ ModelProvider      │
│ state machine    │                     │ (demo / openai)    │
│ metrics, epochs  │                     └────────────────────┘
└──────────────────┘
```

## Independent interfaces

| Interface | Location | Notes |
| --------- | -------- | ----- |
| Dialogue / conversation state | `packages/core` | Framework-independent |
| Speech-to-text | Web (Web Speech API) + optional server stub | Demo typed path needs no STT |
| LLM responses | Server providers | Streaming with abort |
| Text-to-speech | Web Speech Synthesis | Server can return plain text only |
| Avatar rendering | Web `StaticAvatar` | Duix adapter stub documented |
| Session metrics | Core + UI | Real `performance.now` / `Date.now` timestamps |

## Mobile-ready core

`ConversationController` has no DOM dependency. A future mobile client can reuse the same state transitions and epoch cancellation rules.

## Avatar feature matrix

| Feature | Status |
| ------- | ------ |
| Static synthetic avatar + speaking pulse | Implemented |
| Browser TTS mouth activity heuristic | Implemented (not lip-sync) |
| Photoreal audio-driven lip sync | Requires external SDK (e.g. Duix) — **unverified / not shipped** |
| Custom human likeness | Requires user authorization flag |

## Secrets

API keys stay on the server. Client receives capability flags only.
