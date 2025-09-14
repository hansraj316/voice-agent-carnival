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

## Architecture Overview

Multi-modal voice echo agent with direct OpenAI Realtime API integration supporting WebSocket, WebRTC, and SIP connections.

### Core Components

**Server (`src/core/server.js`)**
- `MultiModalVoiceServer` class with Express.js HTTP server
- Direct WebSocket proxy to OpenAI Realtime API
- `WebSocketSessionHandler` manages client-OpenAI message routing
- API endpoints: `/health`, `/api/ephemeral-token`, `/api/sip-session`

**Client (`public/client.js` & `public/index.html`)**
- Multi-modal voice interface with connection type selection
- WebSocket, WebRTC, and SIP connection handlers
- Real-time audio processing and playback
- Voice activity detection and transcription display

### File Structure
```
├── src/
│   ├── core/
│   │   └── server.js       # Multi-modal server with WebSocket proxy
│   ├── routes/
│   │   ├── voice-router.js # Voice API router
│   │   └── voice-api-endpoints.js # API endpoints
│   ├── services/
│   │   └── analytics-tracker.js # Usage and analytics tracking
│   ├── config/
│   │   ├── config-manager.js # Configuration management
│   │   └── voice-providers-config.js # Voice provider configurations
│   └── utils/
│       └── error-handler.js # Error handling utilities
├── public/
│   ├── index.html          # Frontend UI with multi-modal controls
│   └── client.js           # Voice client with WebSocket/WebRTC/SIP handlers
├── data/
│   ├── voice-analytics.json # Analytics data
│   └── voice-config.json   # Configuration data
├── docs/
│   ├── CLAUDE.md           # This file - Claude Code guidance
│   ├── README.md           # Project documentation
│   ├── AGENTS.md           # Agent configuration documentation
│   └── *.md               # Other documentation files
├── scripts/
│   └── validate.js         # Environment and dependency validation
├── package.json            # Dependencies and scripts
├── package-lock.json       # Dependency lock file
├── .env                    # Environment variables (create from .env.example)
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

### Dependencies
- `express` - Web server framework
- `ws` - WebSocket server and client implementation
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management

### Known Issues
See GitHub Issues for current bugs and feature requests:
- Issue #1: Hardcoded WebSocket port prevents connections on non-3000 ports
- Issue #2: Missing favicon.ico returns 404 error
- Issue #3: WebRTC connection error handling needs improvement
- Issue #4: Inconsistent port configuration between .env.example and client code