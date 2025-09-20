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

This is a sophisticated dual-architecture voice AI platform that combines:
1. **Echo Agent**: Direct real-time voice interaction via WebSocket/WebRTC with OpenAI Realtime API
2. **Voice API Router**: OpenRouter-style unified HTTP API for 25+ voice providers with BYOK support

### Core Architecture Patterns

**Dual Server Architecture**
Single Node.js server instance hosting two distinct but complementary services:
- Real-time Echo Agent with WebSocket session management
- HTTP-based Voice API Router with multi-provider abstraction
- Shared configuration, analytics, and error handling infrastructure

**Real-time Communication Layer**
- **WebSocket Proxy**: Server-side API key management with OpenAI Realtime API
- **WebRTC Direct**: Low-latency browser-to-OpenAI connections with ephemeral tokens
- **SIP Integration**: Telephony system support for enterprise voice applications

**Provider Abstraction Pattern**
The `VoiceRouter` class implements a unified interface across 25+ providers:
- **Adapter Pattern**: Provider-specific implementations behind common interface
- **Circuit Breaker**: Automatic provider isolation and fallback mechanisms  
- **Cost Optimization**: Real-time cost tracking and provider selection
- **Error Resilience**: Exponential backoff, retry logic, and health monitoring

**Security Architecture**
- **BYOK (Bring Your Own Key)**: User-provided API keys with AES-256-CBC encryption
- **Session Management**: IP + User-Agent based identification without permanent storage
- **Ephemeral Tokens**: WebRTC token generation for secure direct connections
- **Configuration Encryption**: Secure storage of API keys and user settings

### Core Components

**Server Core (`src/core/server.js`)**
- `MultiModalVoiceServer`: Main server orchestration with Express.js + WebSocket support
- `WebSocketSessionHandler`: Real-time voice session management for Echo Agent
- Dual service hosting: Echo Agent + Voice API Router
- ElevenLabs TTS integration and ephemeral token generation
- Static file serving and health monitoring endpoints

**Voice API Router (`src/routes/voice-api-endpoints.js`)**
- `VoiceAPIEndpoints`: OpenRouter-style RESTful API implementation
- 25+ voice provider support (STT, TTS, Real-time, Conversational, Hybrid)
- Model discovery, provider enumeration, and capability detection
- Speech-to-text, text-to-speech, and conversational endpoints
- Real-time session creation and user configuration management

**Voice Router Core (`src/routes/voice-router.js`)**
- `VoiceRouter`: Universal provider abstraction and request routing
- Adapter pattern implementation for consistent provider interface
- Usage tracking, statistics, and provider validation
- Error handling integration and fallback support
- BYOK architecture with encrypted API key management

**Provider Configuration (`src/config/voice-providers-config.js`)**
- Comprehensive registry of 25+ voice providers
- Provider metadata, capabilities, and pricing models
- Support for real-time, STT, TTS, conversational, and hybrid providers
- Authentication methods and endpoint configuration
- Latency indicators and feature comparisons

**Configuration Management (`src/config/config-manager.js`)**
- `ConfigManager`: Secure API key and user configuration management
- AES-256-CBC encryption for sensitive data storage
- User session management via IP + User-Agent hashing
- Provider configuration persistence and settings management
- Configuration export/import and automatic cleanup

**Analytics & Cost Tracking (`src/services/analytics-tracker.js`)**
- `AnalyticsTracker`: Comprehensive usage analytics and cost calculation
- Multi-provider cost models (per-minute, per-character, per-hour, usage-based)
- Real-time session tracking and performance metrics collection
- Error rate monitoring and cost projection
- Hourly/daily/weekly/monthly reporting with budget tracking

**Error Handling & Resilience (`src/utils/error-handler.js`)**
- `VoiceErrorHandler`: Circuit breaker pattern with exponential backoff
- Provider fallback mechanisms and error categorization
- System health monitoring and automatic recovery
- Three-state circuit breaker (CLOSED, OPEN, HALF_OPEN)
- Comprehensive error tracking and resilience strategies

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
- `/v1/voice/models` - List available models across all providers with capabilities
- `/v1/voice/providers` - Provider discovery with real-time health status
- `/v1/voice/transcribe` - Speech-to-text across 8+ STT providers
- `/v1/voice/synthesize` - Text-to-speech across 10+ TTS providers  
- `/v1/voice/chat` - Conversational voice interactions with context management
- `/v1/voice/realtime/session` - Real-time voice session creation with provider selection
- `/v1/voice/analytics` - Comprehensive usage analytics and performance metrics
- `/v1/voice/cost-report` - Detailed cost analysis across all providers
- `/v1/voice/usage` - Real-time usage tracking and rate limiting
- `/v1/voice/config/provider` - Encrypted provider configuration management
- `/v1/voice/health` - System health monitoring and provider status

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
