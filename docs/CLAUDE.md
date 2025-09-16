# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm start` - Start the production server (default port 3000)
- `npm run dev` - Start development server with auto-reload using `--watch`
- `npm run setup` - Install dependencies and copy `.env.example` to `.env`
- `npm run validate` - Check environment setup and dependencies
- `npm test` - Run syntax check on the server

### Environment Setup
1. Copy `.env.example` to `.env` and configure `OPENAI_API_KEY`
2. Ensure Node.js 18+ is installed
3. Run `npm install` to install dependencies

## MCP Servers
- `context7` – available via `.claude/project.json`; it launches `npx -y @upstash/context7-mcp@latest` so the OpenAI documentation library is always pulled from the latest Context7 MCP release.

### Testing Commands
- `npm test` - Syntax validation of main server file
- `npm run validate` - Environment and dependency validation
- Manual testing via browser at `http://localhost:3000`
- Playwright testing available via browser automation tools

## Architecture Overview

This is a multi-modal voice intelligence platform with dual architecture:
1. **Echo Agent**: Direct WebSocket/WebRTC integration with OpenAI Realtime API
2. **Voice API Router**: OpenRouter-style unified API for multiple voice providers with BYOK support

### Core Architecture Patterns

**Dual Server Architecture**
The system runs two complementary services:
- Primary echo agent server with WebSocket proxy to OpenAI
- Voice API Router providing OpenRouter-style endpoints for multiple providers

**Real-time Communication Layer**
- WebSocket proxy pattern for server-side API key management
- Direct WebRTC for low-latency browser-to-OpenAI connections
- SIP integration support for telephony systems

**Provider Abstraction Pattern**
The `VoiceRouter` class abstracts multiple voice providers (OpenAI, ElevenLabs) behind a unified interface, enabling:
- Provider-agnostic client code
- Easy provider switching and fallbacks
- Consistent error handling across providers

### Core Components

**Server (`src/core/server.js`)**
- `MultiModalVoiceServer` class with Express.js HTTP server
- Integrates both echo agent and Voice API Router functionality
- WebSocket proxy to OpenAI Realtime API
- Serves static frontend files and API endpoints

**Voice API Router (`src/routes/voice-router.js`)**
- Universal voice provider abstraction layer
- Supports OpenAI Realtime, ElevenLabs TTS, and future providers
- Implements circuit breaker pattern for error resilience
- BYOK (Bring Your Own Key) architecture for security

**Configuration Management (`src/config/config-manager.js`)**
- Encrypted storage of API keys and provider settings
- Dynamic configuration loading and updates
- Secure key management with environment variable fallbacks

**Analytics & Tracking (`src/services/analytics-tracker.js`)**
- Real-time usage and cost tracking across all providers
- Session management and performance metrics
- Persistent analytics data in JSON format

**Error Handling (`src/utils/error-handler.js`)**
- Centralized error handling with provider-specific strategies
- Circuit breaker pattern implementation
- Automatic retry logic with exponential backoff

### Data Flow Architecture

**Echo Agent Flow**
```
Browser → WebSocket → Server Proxy → OpenAI Realtime API
   ↓                                        ↓
Audio Input                           Audio Output
   ↓                                        ↓
Web Audio API ← ← ← ← ← ← ← ← ← ← ← ← Response
```

**Voice API Router Flow**
```
Client → HTTP/POST → VoiceRouter → Provider API
   ↓                     ↓              ↓
Request              Route Logic    API Call
   ↓                     ↓              ↓
Analytics ← ← ← ← Response ← ← ← ← Provider Response
```

### File Structure
```
├── src/
│   ├── core/
│   │   └── server.js       # Multi-modal server with WebSocket proxy
│   ├── routes/
│   │   ├── voice-router.js # Universal voice provider router
│   │   └── voice-api-endpoints.js # OpenRouter-style HTTP endpoints
│   ├── services/
│   │   └── analytics-tracker.js # Usage and cost tracking
│   ├── config/
│   │   ├── config-manager.js # Encrypted configuration management
│   │   └── voice-providers-config.js # Provider definitions and schemas
│   └── utils/
│       └── error-handler.js # Circuit breaker and error handling
├── public/
│   ├── index.html          # Echo agent frontend
│   ├── client.js           # WebSocket/WebRTC/SIP client
│   ├── voice-router-ui.html # Voice API Router frontend
│   └── voice-router-client.js # API testing interface
├── data/
│   ├── voice-analytics.json # Persistent analytics data
│   └── voice-config.json   # Encrypted provider configurations
├── docs/                   # Documentation files
├── scripts/
│   └── validate.js         # Environment validation
├── package.json            # Dependencies and scripts
└── .env.example            # Environment template
```

### Technical Configuration

**Audio Settings**
- Format: PCM16 (16-bit PCM)
- Sample Rate: 24000 Hz
- Voice Model: 'alloy' (OpenAI)
- Voice Activity Detection: Server-side (threshold: 0.5)

**API Configuration**
- Model: `gpt-4o-realtime-preview-2024-12-17`
- Temperature: 0.6
- Modalities: `['text', 'audio']`
- Max Response Tokens: 4096

**Voice API Router Endpoints**
- `/v1/voice/models` - List available models across providers
- `/v1/voice/providers` - List configured voice providers
- `/v1/voice/transcribe` - Speech-to-text across providers
- `/v1/voice/synthesize` - Text-to-speech across providers
- `/v1/voice/chat` - Conversational voice interactions
- `/v1/voice/analytics` - Usage and cost analytics
- `/v1/voice/config/provider` - Provider configuration management

### Dependencies
- `express` - Web server framework
- `ws` - WebSocket server and client implementation
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management
- `@elevenlabs/elevenlabs-js` - ElevenLabs voice API client

### Integration Patterns

**Provider Integration**
New voice providers should implement the provider interface defined in `voice-providers-config.js`:
- Connection management methods
- Audio format conversion
- Error handling strategies
- Cost calculation formulas

**Client Integration**
The frontend demonstrates three connection patterns:
- WebSocket for server-proxied connections
- WebRTC for direct browser connections
- SIP configuration for telephony integration

**Analytics Integration**
All voice operations are automatically tracked through the `AnalyticsTracker`:
- Request/response timing
- Provider-specific costs
- Error rates and patterns
- Usage patterns by hour/day

### Configuration Management

**Environment Variables**
- `OPENAI_API_KEY` - Required for OpenAI Realtime API
- `ELEVENLABS_API_KEY` - Optional for ElevenLabs TTS
- `CONFIG_ENCRYPTION_KEY` - For encrypting stored API keys
- `PORT` - Server port (default: 3000)

**Provider Configuration**
API keys and provider settings are stored encrypted in `data/voice-config.json` and managed through the ConfigManager class. The system supports runtime configuration updates without server restart.

### Security Architecture

**API Key Management**
- Server-side storage of API keys (never exposed to clients)
- Encrypted configuration storage
- Ephemeral token generation for WebRTC connections

**BYOK (Bring Your Own Key) Support**
Clients can provide their own API keys for direct provider access while maintaining the unified interface.

### Known Issues
- WebSocket port hardcoded in client (affects non-3000 deployments)
- Missing favicon causes 404 errors
- WebRTC error handling needs enhancement for network failures
- Port configuration inconsistency between `.env.example` and client code
