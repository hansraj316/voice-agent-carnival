import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { VoiceAPIEndpoints } from './voice-api-endpoints.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MultiModalVoiceServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        
        this.setupExpress();
        this.setupWebSocket();
        
        const port = process.env.PORT || 3000;
        this.server.listen(port, () => {
            console.log(`🎤 Multi-Modal Voice Echo Agent running on http://localhost:${port}`);
            console.log(`📡 Supporting: WebSocket | WebRTC | SIP connections`);
            console.log(`🌐 Open: http://localhost:${port}`);
        });
    }
    
    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                api: 'OpenAI Realtime API (Direct)',
                connections: ['WebSocket', 'WebRTC', 'SIP']
            });
        });

        // Endpoint to generate ephemeral tokens for WebRTC
        this.app.post('/api/ephemeral-token', async (req, res) => {
            try {
                if (!process.env.OPENAI_API_KEY) {
                    return res.status(500).json({
                        error: 'OpenAI API key not configured'
                    });
                }

                // Generate ephemeral token for WebRTC connections
                const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-realtime-preview-2024-12-17',
                        voice: 'alloy',
                        turn_detection: {
                            type: 'server_vad'
                        }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to create session (${response.status}): ${errorText}`);
                }

                const session = await response.json();
                
                // Check if response has the expected structure
                if (!session.client_secret || !session.client_secret.value) {
                    throw new Error('Invalid session response: missing client_secret');
                }
                
                res.json({ 
                    token: session.client_secret.value,
                    expires_at: session.client_secret.expires_at,
                    session_id: session.id
                });
            } catch (error) {
                console.error('❌ Failed to generate ephemeral token:', error);
                res.status(500).json({
                    error: 'Failed to generate ephemeral token: ' + error.message
                });
            }
        });

        // SIP endpoint configuration
        this.app.post('/api/sip-session', async (req, res) => {
            try {
                if (!process.env.OPENAI_API_KEY) {
                    return res.status(500).json({
                        error: 'OpenAI API key not configured'
                    });
                }

                // Create SIP session (placeholder - would need SIP server setup)
                res.json({
                    message: 'SIP integration requires additional VoIP infrastructure',
                    documentation: 'https://platform.openai.com/docs/guides/realtime-sip',
                    note: 'Contact your VoIP provider for SIP integration setup'
                });
            } catch (error) {
                console.error('❌ SIP session error:', error);
                res.status(500).json({
                    error: 'SIP session creation failed: ' + error.message
                });
            }
        });

        // ElevenLabs voices endpoint
        this.app.get('/api/elevenlabs/voices', async (req, res) => {
            try {
                if (!process.env.ELEVENLABS_API_KEY) {
                    return res.status(200).json({
                        voices: [],
                        error: 'ElevenLabs API key not configured'
                    });
                }

                const elevenlabs = new ElevenLabsClient({
                    apiKey: process.env.ELEVENLABS_API_KEY
                });

                const voicesResponse = await elevenlabs.voices.getAll();
                
                // Map voiceId to voice_id for client compatibility
                const mappedVoices = (voicesResponse.voices || []).map(voice => ({
                    ...voice,
                    voice_id: voice.voiceId
                }));
                
                res.json({
                    voices: mappedVoices,
                    provider: 'elevenlabs'
                });
            } catch (error) {
                console.error('❌ ElevenLabs voices error:', error);
                res.status(500).json({
                    error: 'Failed to fetch ElevenLabs voices: ' + error.message
                });
            }
        });

        // ElevenLabs text-to-speech endpoint
        this.app.post('/api/elevenlabs/tts', async (req, res) => {
            try {
                if (!process.env.ELEVENLABS_API_KEY) {
                    return res.status(500).json({
                        error: 'ElevenLabs API key not configured'
                    });
                }

                const { text, voiceId, modelId = 'eleven_multilingual_v2' } = req.body;

                if (!text || !voiceId) {
                    return res.status(400).json({
                        error: 'Text and voiceId are required'
                    });
                }

                const elevenlabs = new ElevenLabsClient({
                    apiKey: process.env.ELEVENLABS_API_KEY
                });

                const audio = await elevenlabs.textToSpeech.convert(voiceId, {
                    text: text,
                    modelId: modelId,
                    outputFormat: 'mp3_44100_128'
                });

                // Convert stream to buffer
                const chunks = [];
                const reader = audio.getReader();
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
                
                const audioBuffer = Buffer.concat(chunks);

                res.setHeader('Content-Type', 'audio/mpeg');
                res.send(audioBuffer);
            } catch (error) {
                console.error('❌ ElevenLabs TTS error:', error);
                res.status(500).json({
                    error: 'Failed to generate speech: ' + error.message
                });
            }
        });

        // Initialize Voice API Router endpoints
        new VoiceAPIEndpoints(this.app);

        // Add route for voice router UI
        this.app.get('/voice-router', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'voice-router-ui.html'));
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (clientWs, request) => {
            console.log('🔌 WebSocket client connected from:', request.socket.remoteAddress);
            
            const sessionHandler = new WebSocketSessionHandler(clientWs);
            
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
                console.log('🔌 WebSocket client disconnected');
                sessionHandler.cleanup();
            });
            
            clientWs.on('error', (error) => {
                console.error('❌ WebSocket client error:', error);
                sessionHandler.cleanup();
            });
        });
    }
}

class WebSocketSessionHandler {
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
            console.log('🔗 Connecting to OpenAI Realtime API via WebSocket...');
            
            const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
            
            this.openaiWs = new WebSocket(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });
            
            this.openaiWs.on('open', () => {
                console.log('✅ Connected to OpenAI Realtime API via WebSocket');
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
                        },
                        temperature: 0.6,
                        max_response_output_tokens: 4096
                    }
                });
                
                this.sendToClient({
                    type: 'connected',
                    connection_type: 'websocket',
                    message: 'Connected via WebSocket - Ready to echo!'
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
                console.log(`🔌 OpenAI WebSocket connection closed: ${code} ${reason}`);
                this.isConnectedToOpenAI = false;
                this.sendToClient({
                    type: 'disconnected',
                    message: 'Lost WebSocket connection to OpenAI'
                });
            });
            
            this.openaiWs.on('error', (error) => {
                console.error('❌ OpenAI WebSocket error:', error);
                this.sendToClient({
                    type: 'error',
                    message: 'WebSocket connection error: ' + error.message
                });
            });
            
        } catch (error) {
            console.error('❌ Failed to connect to OpenAI via WebSocket:', error);
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
                
            case 'commit_audio':
                if (this.isConnectedToOpenAI) {
                    this.sendToOpenAI({
                        type: 'input_audio_buffer.commit'
                    });
                    
                    this.sendToOpenAI({
                        type: 'response.create',
                        response: {
                            modalities: ['audio'],
                            instructions: 'Echo back exactly what the user just said.'
                        }
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
                    type: 'speech_started',
                    message: 'Listening...'
                });
                break;
                
            case 'input_audio_buffer.speech_stopped':
                console.log('🛑 Speech ended');
                this.sendToClient({
                    type: 'speech_stopped',
                    message: 'Processing...'
                });
                break;
                
            case 'conversation.item.input_audio_transcription.completed':
                console.log('📝 Transcribed:', message.transcript);
                this.sendToClient({
                    type: 'transcript_input',
                    transcript: message.transcript
                });
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
                    type: 'response_complete',
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
                if (process.env.DEBUG) {
                    console.log('📨 OpenAI message:', message.type);
                }
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
new MultiModalVoiceServer();