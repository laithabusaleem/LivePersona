# Known Limitations

- Photorealistic lip sync is **not implemented**. Static SVG avatar with a speaking heuristic only.
- Browser STT/TTS quality and language support vary by browser (Chromium recommended on Windows).
- Demo dialogue is rule-based and not a general LLM.
- OpenAI-compatible mode requires a network API key and incurs provider costs.
- Session logging is off by default; enabling it writes local JSON under `apps/server/data/sessions`.
- Percentile metrics are withheld until ≥20 turns (documented in UI and `packages/core`).
- Duix Mobile SDK is **not bundled**; its community license and model packs are separate.
