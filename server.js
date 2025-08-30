import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VoiceEchoServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        
        this.setupExpress();
        this.setupWebSocket();
        
        const port = process.env.PORT || 3000;
        this.server.listen(port, () => {
            console.log(`🎤 Voice Echo Agent running on http://localhost:${port}`);
            console.log(`📡 WebSocket server ready`);
        });
    }
    
    setupExpress() {
        this.app.use(cors());
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (clientWs, request) => {
            console.log('🔌 Client connected from:', request.socket.remoteAddress);
            
            const sessionHandler = new SessionHandler(clientWs);
            
            clientWs.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    sessionHandler.handleClientMessage(data);
                } catch (error) {
                    console.error('❌ Failed to parse client message:', error);
                    clientWs.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });
            
            clientWs.on('close', () => {
                console.log('🔌 Client disconnected');
                sessionHandler.cleanup();
            });
            
            clientWs.on('error', (error) => {
                console.error('❌ Client WebSocket error:', error);
                sessionHandler.cleanup();
            });
        });
    }
}

class SessionHandler {
    constructor(clientWs) {
        this.clientWs = clientWs;
        this.openaiWs = null;
        this.isConnectedToOpenAI = false;
        this.audioBuffer = [];
        
        this.connectToOpenAI();
    }
    
    async connectToOpenAI() {
        if (!process.env.OPENAI_API_KEY) {
            this.sendToClient({
                type: 'error',
                message: 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file'
            });
            return;
        }
        
        try {
            console.log('🔗 Connecting to OpenAI Realtime API...');
            
            const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
            
            this.openaiWs = new WebSocket(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });
            
            this.openaiWs.on('open', () => {
                console.log('✅ Connected to OpenAI Realtime API');
                this.isConnectedToOpenAI = true;
                
                // Configure the session for echo functionality
                this.sendToOpenAI({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: `You are a voice echo agent. Your only job is to repeat back exactly what the user says to you. When the user speaks, listen carefully and then repeat their words back to them in a natural, friendly voice. Don't add any commentary, explanation, or additional words - just echo what they said. If you can't understand what they said clearly, ask them to repeat it.`,
                        voice: 'alloy',
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: 'whisper-1'
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 500
                        }
                    }
                });
                
                this.sendToClient({
                    type: 'status',
                    message: 'Connected to OpenAI - Ready to echo!'
                });
            });
            
            this.openaiWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleOpenAIMessage(message);
                } catch (error) {
                    console.error('❌ Failed to parse OpenAI message:', error);
                }
            });
            
            this.openaiWs.on('close', (code, reason) => {
                console.log(`🔌 OpenAI connection closed: ${code} ${reason}`);
                this.isConnectedToOpenAI = false;
                this.sendToClient({
                    type: 'error',
                    message: 'Lost connection to OpenAI'
                });
            });
            
            this.openaiWs.on('error', (error) => {
                console.error('❌ OpenAI WebSocket error:', error);
                this.sendToClient({
                    type: 'error',
                    message: 'OpenAI connection error: ' + error.message
                });
            });
            
        } catch (error) {
            console.error('❌ Failed to connect to OpenAI:', error);
            this.sendToClient({
                type: 'error',
                message: 'Failed to connect to OpenAI: ' + error.message
            });
        }
    }
    
    handleClientMessage(message) {
        switch (message.type) {
            case 'audio_input':
                if (this.isConnectedToOpenAI && message.data) {
                    // Convert the audio data to base64 for OpenAI
                    const audioBuffer = Buffer.from(new Int16Array(message.data).buffer);
                    const base64Audio = audioBuffer.toString('base64');
                    
                    this.sendToOpenAI({
                        type: 'input_audio_buffer.append',
                        audio: base64Audio
                    });
                }
                break;
                
            case 'stop_audio':
                if (this.isConnectedToOpenAI) {
                    this.sendToOpenAI({
                        type: 'input_audio_buffer.commit'
                    });
                }
                break;
                
            default:
                console.log('❓ Unknown client message type:', message.type);
        }
    }
    
    handleOpenAIMessage(message) {
        switch (message.type) {
            case 'session.created':
                console.log('📝 OpenAI session created:', message.session.id);
                break;
                
            case 'session.updated':
                console.log('🔄 OpenAI session updated');
                break;
                
            case 'input_audio_buffer.speech_started':
                console.log('🎤 Speech detected');
                this.sendToClient({
                    type: 'status',
                    message: 'Listening...'
                });
                break;
                
            case 'input_audio_buffer.speech_stopped':
                console.log('🛑 Speech ended');
                this.sendToClient({
                    type: 'status',
                    message: 'Processing...'
                });
                break;
                
            case 'conversation.item.input_audio_transcription.completed':
                console.log('📝 Transcribed:', message.transcript);
                break;
                
            case 'response.audio.delta':
                // Accumulate audio chunks
                if (message.delta) {
                    this.audioBuffer.push(message.delta);
                }
                break;
                
            case 'response.audio.done':
                console.log('🔊 Audio response complete');
                if (this.audioBuffer.length > 0) {
                    // Combine all audio chunks and send to client
                    const completeAudio = this.audioBuffer.join('');
                    const audioData = Buffer.from(completeAudio, 'base64');
                    const audioArray = Array.from(new Int16Array(audioData.buffer));
                    
                    this.sendToClient({
                        type: 'audio_output',
                        data: audioArray
                    });
                    
                    this.audioBuffer = []; // Clear buffer
                }
                break;
                
            case 'response.done':
                console.log('✅ Response complete');
                this.sendToClient({
                    type: 'status',
                    message: 'Echo complete - Ready for next input'
                });
                break;
                
            case 'error':
                console.error('❌ OpenAI error:', message);
                this.sendToClient({
                    type: 'error',
                    message: message.error?.message || 'Unknown OpenAI error'
                });
                break;
                
            default:
                // Log other message types for debugging
                console.log('📨 OpenAI message:', message.type);
        }
    }
    
    sendToClient(message) {
        if (this.clientWs && this.clientWs.readyState === WebSocket.OPEN) {
            this.clientWs.send(JSON.stringify(message));
        }
    }
    
    sendToOpenAI(message) {
        if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
            this.openaiWs.send(JSON.stringify(message));
        }
    }
    
    cleanup() {
        if (this.openaiWs) {
            this.openaiWs.close();
        }
    }
}

// Start the server
new VoiceEchoServer();