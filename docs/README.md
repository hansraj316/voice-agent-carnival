# 🎤 Multi-Modal Voice Echo Agent

A real-time voice agent that echoes what you say using OpenAI's Realtime API with support for all three connection types: WebSocket, WebRTC, and SIP. Built with the official OpenAI Realtime API and GPT-4o model.

## ✨ Features

- **Multi-Modal Connections**: Choose between WebSocket, WebRTC, or SIP connection types
- **Echo Functionality**: Repeats back exactly what you say in natural, friendly voice
- **Official Realtime API**: Built with OpenAI's direct Realtime API (platform.openai.com/docs/guides/realtime-websocket)
- **Beautiful UI**: Responsive design with connection type selector and real-time status
- **WebRTC Support**: Direct browser-to-OpenAI connection with lowest latency
- **Production Ready**: Ephemeral tokens, proper error handling, and security best practices

## 🛠 Technologies Used

- **Backend**: Node.js, Express, Direct OpenAI Realtime API, Multi-provider Voice Router
- **Frontend**: Vanilla JavaScript, ES6 Modules, WebRTC/WebSocket clients, Voice Router UI
- **AI**: OpenAI GPT-4o Realtime API + 25+ voice providers (STT, TTS, Conversational, Hybrid)
- **Connections**: WebSocket proxy, WebRTC direct, SIP integration support
- **Audio**: PCM16 format at 24kHz with Web Audio API and native WebRTC
- **Security**: AES-256-CBC encryption, BYOK architecture, ephemeral tokens
- **Analytics**: Real-time cost tracking, usage monitoring, performance metrics

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key with access to Realtime API
- Modern web browser with microphone support

### Installation

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd voice-agent-carnival
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key:
   # OPENAI_API_KEY=your_api_key_here
   ```

3. **Start the server**:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Open in browser**:
   ```
   # Echo Agent (Original Voice Interface)
   http://localhost:3000
   
   # Voice API Router (OpenRouter-style Multi-provider API)
   http://localhost:3000/voice-router
   ```

### Getting OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Ensure you have access to the Realtime API (may require waitlist approval)

## 🔗 Connection Types

### 🔌 WebSocket (Default)
- **Best for**: Server-side applications, prototyping, development
- **How it works**: Browser connects to local server, server proxies to OpenAI
- **Latency**: Good for most use cases
- **Security**: API key stays on server

### 📡 WebRTC (Recommended for Production)  
- **Best for**: Production client applications, mobile apps
- **How it works**: Direct peer-to-peer connection from browser to OpenAI
- **Latency**: Lowest possible latency (~200-400ms)
- **Security**: Uses ephemeral tokens, no API key exposure

### 📞 SIP (Enterprise/Telephony)
- **Best for**: Phone systems, call centers, VoIP integration
- **How it works**: Integrates with existing telephony infrastructure
- **Setup**: Requires VoIP provider and SIP server configuration
- **Use case**: Voice agents accessible via phone calls

## 🎯 How to Use

1. **Choose Connection**: Select WebSocket, WebRTC, or SIP from the dropdown
2. **Connect**: Click "Connect" to establish your chosen connection type
3. **Start Listening**: Click the microphone button (🎤) to start voice input
4. **Speak**: Talk into your microphone - the agent will listen
5. **Hear Echo**: The agent will repeat back what you said in a natural voice
6. **Continue**: Keep talking - the agent maintains context throughout the session

## 🏗 Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐    WebSocket     ┌─────────────────┐
│                 │◄────────────────►│                 │◄────────────────►│                 │
│  Web Client     │                  │  Node.js Server │                  │  OpenAI         │
│  (Browser)      │                  │  (Proxy)        │                  │  Realtime API   │
│                 │                  │                 │                  │                 │
└─────────────────┘                  └─────────────────┘                  └─────────────────┘
        │                                     │                                     │
        │                                     │                                     │
    Web Audio API                      WebSocket Proxy                    GPT-4o Realtime
    - Microphone                       - Audio buffering                  - Voice processing  
    - Speaker output                   - Format conversion                - Natural responses
    - Real-time processing             - Session management               - Voice synthesis
```

## 🔧 Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 3000)

### Audio Settings

The system is configured for optimal quality:
- **Sample Rate**: 24kHz
- **Format**: PCM16 (16-bit PCM)
- **Channels**: Mono (1 channel)
- **Buffer Size**: 4096 samples
- **Voice Activity Detection**: Server-side VAD with 500ms silence detection

## 📡 API Integration

### OpenAI Realtime API Features Used

- **Persistent WebSocket Connection**: Maintains real-time bidirectional communication
- **Voice Activity Detection**: Server-side VAD for natural conversation flow
- **Audio Streaming**: Real-time PCM16 audio input/output
- **Session Management**: Configured for echo-specific behavior
- **Natural Voice Synthesis**: Uses 'alloy' voice model for pleasant output

### Context7 MCP Integration

The project includes Context7 MCP server for accessing up-to-date OpenAI documentation:

```bash
# Context7 is installed globally and can be used for documentation
npx @upstash/context7-mcp
```

## 🧪 Testing

1. **Basic Functionality**:
   - Test microphone access permission
   - Verify WebSocket connection
   - Test echo with simple words/phrases

2. **Edge Cases**:
   - Network disconnection/reconnection
   - Microphone permission denied
   - Background noise handling
   - Multiple rapid inputs

3. **Audio Quality**:
   - Test with different speech patterns
   - Verify audio clarity and latency
   - Test voice activity detection accuracy

## 🐛 Troubleshooting

### Common Issues

**"Microphone access denied"**
- Check browser permissions for microphone access
- Ensure HTTPS (or localhost) for microphone API access

**"Failed to connect to OpenAI"**
- Verify your API key in `.env` file
- Check if you have Realtime API access
- Ensure stable internet connection

**"Audio not playing"**
- Check browser audio permissions
- Verify speakers/headphones are working
- Check Web Audio API support in browser

**"WebSocket connection failed"**
- Ensure server is running on port 3000
- Check firewall settings
- Verify WebSocket support in browser

### Debug Mode

Enable verbose logging by adding to your environment:
```bash
DEBUG=true npm start
```

## 📊 Performance

- **Latency**: ~500ms time-to-first-byte from OpenAI
- **Audio Quality**: 24kHz PCM16 for professional quality
- **Memory Usage**: Optimized buffer management for real-time streaming
- **Network**: Efficient WebSocket communication with minimal overhead

## 🔒 Security

- API keys stored securely in environment variables
- No audio data stored permanently
- WebSocket connections are encrypted (WSS) to OpenAI
- Client-side audio processing with no server storage

## 🚀 Deployment

For production deployment:

1. **Environment Setup**:
   ```bash
   NODE_ENV=production
   OPENAI_API_KEY=your_production_key
   PORT=80
   ```

2. **HTTPS Setup**: Required for microphone access in production
3. **Process Management**: Use PM2 or similar for process management
4. **Monitoring**: Add logging and error tracking

## 📈 Future Enhancements

- [ ] Voice activity detection improvements
- [ ] Multiple voice models selection
- [ ] Audio effects and processing
- [ ] Session recording and playback
- [ ] Multi-language support
- [ ] Custom echo patterns and responses
- [ ] Mobile app version
- [ ] Real-time transcription display

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`) 
5. Open a Pull Request

---

Built with ❤️ using OpenAI's GPT-Realtime API and modern web technologies.