# Avatar feature matrix

| Feature | Implemented? | Requires download? | Requires external service? |
| ------- | ------------ | ------------------ | -------------------------- |
| Static synthetic avatar | Yes | No | No |
| Speaking pulse / mouth heuristic while TTS plays | Yes | No | Browser TTS optional |
| Typed dialogue (demo) | Yes | No | No |
| Streamed LLM dialogue | Yes | No | OpenAI-compatible API when configured |
| Browser push-to-talk STT | Yes (when browser supports) | No | Mic permission |
| Browser TTS | Yes (when browser supports) | No | No |
| Photoreal audio-driven lip sync | **No** | Would need vendor models | Would need Duix or similar SDK |
| Custom human likeness | Blocked until authorization flag | Likeness assets | Consent required |
| Voice cloning | **No** | N/A | N/A |

## Duix-Mobile research note

[Duix-Mobile](https://github.com/duixcom/Duix-Mobile) documents on-device mobile avatars with lip sync and barge-in under a **custom Duix Community License**. LivePersona does not ship Duix code or models. Any future adapter must verify SDK APIs, latency claims, and license obligations before claiming compatibility.
