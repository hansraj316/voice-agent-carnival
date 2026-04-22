

## Daily TPM delivery update (2026-04-22)
- Functional: Ship multi-voice conversation mode with per-character memory and turn styling
- Non-functional: Optimize streaming latency budget and add p95 latency dashboard alerts

## Demo Workflow Prototype: Sales Call -> CRM (Grok STT)
- Endpoint: `POST /v1/voice/workflows/sales-call-to-crm`
- Provider path: `xai-grok-stt` (xAI Grok speech transcription)
- Output: transcript + extracted sales summary + CRM-ready payload
- Docs: `docs/grok-sales-call-crm-prototype.md`
