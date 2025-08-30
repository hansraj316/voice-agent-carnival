# 🎤 Voice Echo Agent

A real-time voice agent that echoes what you say using OpenAI's latest GPT-Realtime API. Built with WebSockets, Web Audio API, and the cutting-edge GPT-4o Realtime model.

## ✨ Features

- **Real-time Voice Processing**: Uses OpenAI's GPT-Realtime API for ultra-low latency voice interactions
- **Echo Functionality**: Repeats back exactly what you say in natural, friendly voice
- **Modern Web Technologies**: Built with Web Audio API, WebSockets, and ES6 modules
- **Beautiful UI**: Responsive design with real-time status indicators and audio visualizations
- **Voice Activity Detection**: Automatic speech detection and turn management
- **High-Quality Audio**: 24kHz PCM16 audio processing for crystal clear voice

## 🛠 Technologies Used

- **Backend**: Node.js, Express, WebSockets (`ws`)
- **Frontend**: Vanilla JavaScript, Web Audio API, WebSockets
- **AI**: OpenAI GPT-4o Realtime API (gpt-4o-realtime-preview-2024-10-01)
- **Documentation**: Context7 MCP server for up-to-date API docs
- **Audio**: PCM16 format at 24kHz sample rate

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
   http://localhost:3000
   ```

### Getting OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Ensure you have access to the Realtime API (may require waitlist approval)

## 🎯 How to Use

1. **Connect**: Click the "Connect" button to establish WebSocket connection
2. **Start Listening**: Click the microphone button (🎤) to start voice input
3. **Speak**: Talk into your microphone - the agent will listen
4. **Hear Echo**: The agent will repeat back what you said in a natural voice
5. **Continue**: Keep talking - the agent maintains context throughout the session

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