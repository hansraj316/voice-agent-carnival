# Grok STT Sales Call -> CRM Prototype

This demo workflow converts a recorded sales call into a CRM-ready update payload.

## Flow

1. Audio in (`audio_file` base64 or `audio_url`)
2. Transcription via xAI Grok STT (`xai-grok-stt` provider)
3. Lightweight extraction of:
   - lead/account
   - stage
   - deal value
   - timeline
   - pain points
   - next steps
4. Return a demo CRM payload (`deal_update`) ready to post to a CRM connector

## Endpoint

`POST /v1/voice/workflows/sales-call-to-crm`

## Request body

```json
{
  "api_key": "xai-api-key",
  "model": "grok-2-vision-audio-preview",
  "language": "en",
  "audio_url": "https://example.com/sales-call.wav"
}
```

or

```json
{
  "api_key": "xai-api-key",
  "audio_file": "<base64-audio>",
  "options": {
    "filename": "call.wav",
    "mimeType": "audio/wav"
  }
}
```

## Response shape

```json
{
  "object": "workflow_result",
  "workflow": "sales-call-to-crm",
  "provider": "xai-grok-stt",
  "transcript": "...",
  "extracted": {
    "lead_name": "...",
    "account_name": "...",
    "stage": "Discovery|Proposal|Pilot|Negotiation",
    "opportunity_value": "$50,000",
    "timeline": "Q3",
    "pain_points": ["Manual", "Reporting"],
    "next_steps": ["Send proposal"],
    "summary": "..."
  },
  "crm_payload": {
    "crm": "demo-crm",
    "object": "deal_update",
    "generated_at": "...",
    "fields": { "...": "..." },
    "notes": "...",
    "transcript_excerpt": "..."
  }
}
```

## Notes

- This is intentionally heuristic for demo speed.
- Swap `buildCrmPayload` for Salesforce/HubSpot specific schemas when productionizing.
