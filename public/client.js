class MultiModalVoiceClient {
    constructor() {
        this.connectionType = 'websocket'; // Default
        this.connection = null;
        this.audioContext = null;
        this.stream = null;
        this.isConnected = false;
        this.isListening = false;
        this.processor = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeConnectionHandlers();
    }
    
    initializeElements() {
        this.statusEl = document.getElementById('status');
        this.connectionTypeSelect = document.getElementById('connectionType');
        this.connectBtn = document.getElementById('connectBtn');
        this.micBtn = document.getElementById('micBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.logEl = document.getElementById('log');
        this.connectionInfo = document.getElementById('connectionInfo');
    }
    
    setupEventListeners() {
        this.connectionTypeSelect.addEventListener('change', (e) => {
            this.connectionType = e.target.value;
            this.updateConnectionInfo();
        });
        this.connectBtn.addEventListener('click', () => this.connect());
        this.micBtn.addEventListener('click', () => this.toggleListening());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        
        // Initialize connection info
        this.updateConnectionInfo();
    }
    
    initializeConnectionHandlers() {
        this.connectionHandlers = {
            websocket: new WebSocketHandler(this),
            webrtc: new WebRTCHandler(this),
            sip: new SIPHandler(this)
        };
    }
    
    updateConnectionInfo() {
        const info = {
            websocket: 'Server-side proxy to OpenAI. Best for prototyping and server applications.',
            webrtc: 'Direct browser connection to OpenAI. Best for production client apps with lowest latency.',
            sip: 'VoIP telephony integration. Best for phone systems and call centers.'
        };
        
        this.connectionInfo.textContent = info[this.connectionType];
    }
    
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        this.logEl.appendChild(entry);
        this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    
    updateStatus(status, className = '') {
        this.statusEl.textContent = status;
        this.statusEl.className = `status ${className}`;
    }
    
    async connect() {
        const handler = this.connectionHandlers[this.connectionType];
        if (handler) {
            await handler.connect();
        }
    }
    
    disconnect() {
        const handler = this.connectionHandlers[this.connectionType];
        if (handler) {
            handler.disconnect();
        }
        this.stopListening();
    }
    
    async toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            await this.startListening();
        }
    }
    
    async startListening() {
        try {
            if (!this.isConnected) {
                this.log('Not connected', 'error');
                return;
            }
            
            this.log('Requesting microphone access...');
            
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Initialize Web Audio API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000
            });
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create audio processing pipeline
            const source = this.audioContext.createMediaStreamSource(this.stream);
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.processor.onaudioprocess = (event) => {
                if (this.isListening) {
                    const channelData = event.inputBuffer.getChannelData(0);
                    const pcm16 = this.floatTo16BitPCM(channelData);
                    
                    const handler = this.connectionHandlers[this.connectionType];
                    if (handler) {
                        handler.sendAudio(Array.from(pcm16));
                    }
                }
            };
            
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            
            this.isListening = true;
            this.updateStatus('Listening...', 'listening');
            this.micBtn.classList.add('listening');
            this.micBtn.textContent = '🔴';
            this.log('Microphone active - speak to echo');
            
        } catch (error) {
            this.log(`Microphone access failed: ${error.message}`, 'error');
        }
    }
    
    stopListening() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        this.isListening = false;
        this.updateStatus('Connected', 'connected');
        this.micBtn.classList.remove('listening');
        this.micBtn.textContent = '🎤';
        this.log('Microphone stopped');
    }
    
    async playAudio(audioData) {
        try {
            this.updateStatus('Playing echo...', 'speaking');
            
            // Convert array back to ArrayBuffer
            const arrayBuffer = new ArrayBuffer(audioData.length * 2);
            const view = new Int16Array(arrayBuffer);
            for (let i = 0; i < audioData.length; i++) {
                view[i] = audioData[i];
            }
            
            // Create audio context if needed
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 24000
                });
            }
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Decode and play audio
            const audioBuffer = await this.pcm16ToAudioBuffer(view);
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            source.onended = () => {
                this.updateStatus('Connected', 'connected');
            };
            
            source.start();
            this.log('Playing echo response');
            
        } catch (error) {
            this.log(`Audio playback failed: ${error.message}`, 'error');
            this.updateStatus('Connected', 'connected');
        }
    }
    
    floatTo16BitPCM(input) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const sample = Math.max(-1, Math.min(1, input[i]));
            output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return output;
    }
    
    async pcm16ToAudioBuffer(pcm16Data) {
        const audioBuffer = this.audioContext.createBuffer(1, pcm16Data.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < pcm16Data.length; i++) {
            channelData[i] = pcm16Data[i] / (pcm16Data[i] < 0 ? 0x8000 : 0x7FFF);
        }
        
        return audioBuffer;
    }
}

// WebSocket Connection Handler
class WebSocketHandler {
    constructor(client) {
        this.client = client;
        this.ws = null;
    }
    
    async connect() {
        try {
            this.client.log('Connecting via WebSocket...');
            this.ws = new WebSocket('ws://localhost:3000');
            
            this.ws.onopen = () => {
                this.client.isConnected = true;
                this.client.updateStatus('Connected via WebSocket', 'connected');
                this.client.connectBtn.disabled = true;
                this.client.micBtn.disabled = false;
                this.client.disconnectBtn.disabled = false;
                this.client.log('✅ WebSocket connection established');
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                this.client.isConnected = false;
                this.client.updateStatus('Disconnected');
                this.client.connectBtn.disabled = false;
                this.client.micBtn.disabled = true;
                this.client.disconnectBtn.disabled = true;
                this.client.log('WebSocket connection closed');
            };
            
            this.ws.onerror = (error) => {
                this.client.log(`WebSocket error: ${error.message}`, 'error');
            };
            
        } catch (error) {
            this.client.log(`WebSocket connection failed: ${error.message}`, 'error');
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
    
    sendAudio(audioData) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'audio_input',
                data: audioData
            }));
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'audio_output':
                this.client.playAudio(message.data);
                break;
            case 'transcript_input':
                this.client.log(`You said: "${message.transcript}"`);
                break;
            case 'speech_started':
                this.client.updateStatus('Listening...', 'listening');
                break;
            case 'speech_stopped':
                this.client.updateStatus('Processing...', 'connected');
                break;
            case 'response_complete':
                this.client.updateStatus('Connected via WebSocket', 'connected');
                break;
            case 'error':
                this.client.log(`Error: ${message.message}`, 'error');
                break;
            default:
                this.client.log(`Server: ${message.message || message.type}`);
        }
    }
}

// WebRTC Connection Handler
class WebRTCHandler {
    constructor(client) {
        this.client = client;
        this.peerConnection = null;
        this.dataChannel = null;
        this.audioTrack = null;
    }
    
    async connect() {
        try {
            this.client.log('Getting ephemeral token for WebRTC...');
            
            // Get ephemeral token from server
            const response = await fetch('/api/ephemeral-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get ephemeral token: ${response.statusText}`);
            }
            
            const { token } = await response.json();
            
            this.client.log('Setting up WebRTC connection...');
            
            // Create RTCPeerConnection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            // Create data channel for events
            this.dataChannel = this.peerConnection.createDataChannel('events', {
                ordered: true
            });
            
            this.dataChannel.onopen = () => {
                this.client.log('✅ WebRTC data channel opened');
                
                // Configure session
                this.sendEvent({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: 'You are a voice echo agent. Repeat back exactly what the user says.',
                        voice: 'alloy',
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.5,
                            silence_duration_ms: 500
                        },
                        temperature: 0.1
                    }
                });
            };
            
            this.dataChannel.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleOpenAIMessage(message);
                } catch (error) {
                    this.client.log(`Failed to parse WebRTC message: ${error.message}`, 'error');
                }
            };
            
            // Handle incoming audio track
            this.peerConnection.ontrack = (event) => {
                this.client.log('📻 Received audio track from OpenAI');
                const audio = new Audio();
                audio.srcObject = event.streams[0];
                audio.play().catch(e => this.client.log(`Audio play error: ${e.message}`, 'error'));
            };
            
            // Get user media for audio input
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Add audio track to peer connection
            this.audioTrack = stream.getAudioTracks()[0];
            this.peerConnection.addTrack(this.audioTrack, stream);
            
            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Send offer to OpenAI
            const rtcResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-realtime-preview-2024-12-17',
                    voice: 'alloy',
                    type: 'webrtc',
                    offer: {
                        sdp: offer.sdp,
                        type: offer.type
                    }
                })
            });
            
            if (!rtcResponse.ok) {
                throw new Error(`WebRTC setup failed: ${rtcResponse.statusText}`);
            }
            
            const session = await rtcResponse.json();
            
            // Set remote description
            await this.peerConnection.setRemoteDescription(session.answer);
            
            this.client.isConnected = true;
            this.client.updateStatus('Connected via WebRTC', 'connected');
            this.client.connectBtn.disabled = true;
            this.client.micBtn.disabled = false;
            this.client.disconnectBtn.disabled = false;
            this.client.log('✅ WebRTC connection established with OpenAI');
            
        } catch (error) {
            this.client.log(`WebRTC connection failed: ${error.message}`, 'error');
            console.error('WebRTC error:', error);
        }
    }
    
    disconnect() {
        if (this.audioTrack) {
            this.audioTrack.stop();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.client.isConnected = false;
        this.client.updateStatus('Disconnected');
        this.client.connectBtn.disabled = false;
        this.client.micBtn.disabled = true;
        this.client.disconnectBtn.disabled = false;
    }
    
    sendAudio(audioData) {
        // For WebRTC, audio is sent via the audio track automatically
        // We don't need to manually send audio data
    }
    
    sendEvent(event) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(event));
        }
    }
    
    handleOpenAIMessage(message) {
        switch (message.type) {
            case 'session.created':
                this.client.log('📝 WebRTC session created');
                break;
            case 'conversation.item.input_audio_transcription.completed':
                this.client.log(`You said: "${message.transcript}"`);
                break;
            case 'response.done':
                this.client.log('✅ Echo response complete');
                break;
            case 'error':
                this.client.log(`OpenAI error: ${message.error?.message}`, 'error');
                break;
        }
    }
}

// SIP Connection Handler  
class SIPHandler {
    constructor(client) {
        this.client = client;
    }
    
    async connect() {
        try {
            this.client.log('Checking SIP configuration...');
            
            const response = await fetch('/api/sip-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            this.client.log('ℹ️  ' + data.message, 'info');
            this.client.log('📖 Documentation: ' + data.documentation, 'info');
            this.client.log('💡 ' + data.note, 'info');
            
            // For demonstration, we'll show that SIP requires additional setup
            this.client.updateStatus('SIP requires VoIP infrastructure', 'connected');
            
        } catch (error) {
            this.client.log(`SIP setup error: ${error.message}`, 'error');
        }
    }
    
    disconnect() {
        this.client.log('SIP disconnected');
        this.client.isConnected = false;
    }
    
    sendAudio(audioData) {
        // SIP audio would be handled by VoIP infrastructure
        this.client.log('SIP audio handling requires VoIP server setup');
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiModalVoiceClient();
});