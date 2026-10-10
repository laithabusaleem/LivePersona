# LivePersona — Product Specification

## Problem

Interactive avatar demos often couple dialogue, speech, and animation into a fragile monolith, ignore barge-in, or imply photoreal lip-sync that only works with proprietary SDKs. Students need a clear, privacy-aware conversation stack that works in a browser demo without paid services.

## Intended users

- Students and indie builders prototyping conversational agents
- Portfolio reviewers evaluating systems design and interruption handling

## Product summary

**LivePersona** is a browser-based interactive avatar app. Users type or speak questions; the assistant replies with text and optional speech while a clearly labeled **synthetic avatar** animates at a non-photoreal level. A unique **interruption-aware** conversation state machine cancels obsolete speech and stale responses.

## Inspiration note

Product category inspiration: [Duix-Mobile](https://github.com/duixcom/Duix-Mobile) (custom Duix Community License). LivePersona does **not** include Duix SDK code, models, or assets. Photorealistic on-device lip sync is documented as an **unverified optional integration**, not recreated with CSS.

## Modes

| Mode | Requirements | Capabilities |
| ---- | ------------ | ------------ |
| Demo / static avatar | None | Typed chat, rule-based replies, browser TTS optional, static avatar with speaking pulse |
| OpenAI-compatible LLM | API key on server | Real streamed dialogue tokens |
| Browser STT/TTS | Mic permission + browser support | Spoken input / speech output |
| Duix / photoreal lip sync | External SDK + models | **Not implemented** — adapter stub only |

## Unique enhancement: interruption-aware interaction

States: `idle` → `listening` → `transcribing` → `generating` → `speaking` → (`interrupted` → `recovering` → `idle`) | `error`.

Interrupting cancels in-flight generation, stops audio, increments a response epoch so late tokens never speak.

## Privacy

- Synthetic identity always labeled
- Custom likeness / voice cloning require explicit authorization fields (blocked until authorized)
- Microphone permission status visible; stop control always available
- Session logging off by default; opt-in with inspect/delete

## License proposal

**MIT** for LivePersona original code. Do not incorporate Duix materials without complying with their community license.
