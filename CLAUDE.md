# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm start` - Start the production server on port 3000
- `npm run dev` - Start development server with auto-reload using `--watch`
- `npm run setup` - Install dependencies and copy `.env.example` to `.env`
- `npm run validate` - Check environment setup and dependencies
- `npm test` - Run syntax check on server.js

### Environment Setup
1. Copy `.env.example` to `.env` and configure `OPENAI_API_KEY`
2. Ensure Node.js 18+ is installed
3. Run `npm install` to install dependencies

## Architecture Overview

This is a multi-modal voice echo agent with direct OpenAI Realtime API WebSocket integration. The architecture supports WebSocket, WebRTC, and SIP connections:

### Core Components

**Server (`server.js`)**
- `MultiModalVoiceServer` class with Express.js HTTP server
- Direct WebSocket proxy to OpenAI Realtime API (`wss://api.openai.com/v1/realtime`)
- `WebSocketSessionHandler` manages client-OpenAI message routing
- Ephemeral token generation via `/api/ephemeral-token` for WebRTC
- SIP session endpoint at `/api/sip-session` (placeholder for VoIP integration)
- Health check endpoint at `/health`

**Client (`public/client.js` & `public/index.html`)**
- Direct integration with OpenAI Agents SDK via CDN import
- `RealtimeSession` class for WebRTC/WebSocket audio handling
- Automatic microphone access and audio streaming
- Real-time transcription display and audio playback

### Key Technical Details

**WebSocket Architecture**
- Client ↔ Server ↔ OpenAI Realtime API proxy pattern
- Server handles `WebSocketSessionHandler` for each client connection
- Audio data flows as base64-encoded PCM16 through WebSocket messages
- Real-time message routing between client and OpenAI

**Audio Configuration**
- Format: PCM16 (16-bit PCM)
- Voice: 'alloy' model from OpenAI
- Server-side Voice Activity Detection (VAD)
- Threshold: 0.5, Silence: 500ms, Padding: 300ms

**Session Configuration**
- Model: `gpt-4o-realtime-preview-2024-12-17`
- Temperature: 0.1 (for consistent echoing)
- Modalities: `['text', 'audio']`
- Input transcription: Whisper-1 model
- Max response tokens: 4096

### File Structure
```
├── server.js          # Multi-modal server with WebSocket proxy
├── validate.js        # Environment and dependency validation
├── public/
│   ├── index.html     # Frontend UI with multi-modal controls
│   └── client.js      # RealtimeSession client with SDK integration
├── .env.example       # Environment template
└── package.json       # Dependencies and scripts
```

### Dependencies
- `express` - Web server framework
- `ws` - WebSocket server and client implementation
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management

### Development Notes
- Uses ES6 modules (`"type": "module"` in package.json)
- Client imports OpenAI Agents SDK from CDN (`https://cdn.jsdelivr.net/npm/@openai/agents@0.1.0/realtime/+esm`)
- Direct WebSocket communication with OpenAI (no intermediate SDK on server)
- Audio buffering and chunking handled in `WebSocketSessionHandler`
- Supports multiple connection types: WebSocket, WebRTC, SIP (SIP requires additional VoIP setup)
- Debug mode available via `DEBUG=true` environment variable