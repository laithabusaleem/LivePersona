# Test Plan

## Unit (`packages/core`)

- State transitions for happy path and interruption
- Stale response epoch rejects late tokens
- Metrics timestamps ordered correctly
- Percentiles withheld when sample size < documented threshold (n < 20)

## Integration (`apps/server`)

- Demo chat returns without API key
- OpenAI provider reports unavailable when unconfigured
- Abort cancels generation
- Session log create/list/delete when enabled

## Manual

1. Typed demo conversation
2. Interrupt mid-speech (browser TTS)
3. Disable mic / fail STT — typed path still works
4. Synthetic identity banner visible
