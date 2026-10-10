# Implementation Plan

## Defaults

| Decision | Choice |
| -------- | ------ |
| Stack | npm workspaces, TS core, Express, Vite React |
| Demo dialogue | Deterministic local replies (no API) |
| Speech | Browser Web Speech where available |
| Avatar | SVG static persona + speaking animation |
| License | MIT |
| Lip sync | Documented stub only |

## Priority

1. Core state machine + epoch cancellation
2. Demo dialogue + OpenAI-compatible streaming
3. Web UI with interrupt + metrics
4. Privacy controls + optional session log
5. Tests + docs + CI
