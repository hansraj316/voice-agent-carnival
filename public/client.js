class MultiModalVoiceClient {
    constructor() {
        this.connectionType = 'websocket'; // Default
        this.voiceProvider = 'openai'; // Default
        this.selectedVoice = null;
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
        this.voiceProviderSelect = document.getElementById('voiceProvider');
        this.voiceSelectionSelect = document.getElementById('voiceSelection');
        this.voiceSelectorDiv = document.getElementById('voiceSelector');
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
        
        this.voiceProviderSelect.addEventListener('change', (e) => {
            this.voiceProvider = e.target.value;
            this.updateVoiceOptions();
        });
        
        this.voiceSelectionSelect.addEventListener('change', (e) => {
            this.selectedVoice = e.target.value;
        });
        
        this.connectBtn.addEventListener('click', () => this.connect());
        this.micBtn.addEventListener('click', () => this.toggleListening());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        
        // Initialize connection info and voice options
        this.updateConnectionInfo();
        this.updateVoiceOptions();
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
    
    async updateVoiceOptions() {
        if (this.voiceProvider === 'openai') {
            // Hide voice selector for OpenAI (uses default 'alloy' voice)
            this.voiceSelectorDiv.style.display = 'none';
            this.selectedVoice = 'alloy';
        } else if (this.voiceProvider === 'elevenlabs') {
            // Show voice selector and fetch ElevenLabs voices
            this.voiceSelectorDiv.style.display = 'block';
            this.voiceSelectionSelect.innerHTML = '<option value="">Loading voices...</option>';
            
            try {
                const response = await fetch('/api/elevenlabs/voices');
                const data = await response.json();
                
                if (data.error) {
                    this.log(data.error, 'error');
                    this.voiceSelectionSelect.innerHTML = '<option value="">No voices available</option>';
                    return;
                }
                
                // Populate voice dropdown
                this.voiceSelectionSelect.innerHTML = '';
                if (data.voices && data.voices.length > 0) {
                    data.voices.forEach(voice => {
                        const option = document.createElement('option');
                        option.value = voice.voice_id;
                        option.textContent = `${voice.name} (${voice.category || 'Custom'})`;
                        this.voiceSelectionSelect.appendChild(option);
                    });
                    
                    // Select first voice by default
                    this.selectedVoice = data.voices[0].voice_id;
                    this.voiceSelectionSelect.value = this.selectedVoice;
                    
                    this.log(`Loaded ${data.voices.length} ElevenLabs voices`);
                } else {
                    this.voiceSelectionSelect.innerHTML = '<option value="">No voices available</option>';
                }
            } catch (error) {
                this.log(`Failed to fetch ElevenLabs voices: ${error.message}`, 'error');
                this.voiceSelectionSelect.innerHTML = '<option value="">Error loading voices</option>';
            }
        }
    }
    
    async playElevenLabsAudio(text) {
        if (!this.selectedVoice) {
            this.log('No voice selected for ElevenLabs', 'error');
            return;
        }
        
        try {
            this.updateStatus('Generating speech...', 'speaking');
            
            const response = await fetch('/api/elevenlabs/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voiceId: this.selectedVoice,
                    modelId: 'eleven_multilingual_v2'
                })
            });
            
            if (!response.ok) {
                throw new Error(`TTS failed: ${response.statusText}`);
            }
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                this.updateStatus('Connected', 'connected');
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = () => {
                this.log('Audio playback failed', 'error');
                this.updateStatus('Connected', 'connected');
                URL.revokeObjectURL(audioUrl);
            };
            
            await audio.play();
            this.log('Playing ElevenLabs audio');
            
        } catch (error) {
            this.log(`ElevenLabs TTS error: ${error.message}`, 'error');
            this.updateStatus('Connected', 'connected');
        }
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
            const wsUrl = `ws://${window.location.hostname}:${window.location.port}`;
            this.ws = new WebSocket(wsUrl);
            
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
                if (this.client.voiceProvider === 'openai') {
                    this.client.playAudio(message.data);
                }
                break;
            case 'transcript_input':
                this.client.log(`You said: "${message.transcript}"`);
                
                // Use ElevenLabs TTS if selected
                if (this.client.voiceProvider === 'elevenlabs' && message.transcript) {
                    this.client.playElevenLabsAudio(message.transcript);
                }
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
        this.retryCount = 0;
        this.maxRetries = 3;
        this.baseDelay = 1000; // 1 second
    }
    
    async connect() {
        return this.connectWithRetry();
    }
    
    async connectWithRetry() {
        try {
            await this.attemptConnection();
        } catch (error) {
            if (this.retryCount < this.maxRetries && this.shouldRetry(error)) {
                this.retryCount++;
                const delay = this.getRetryDelay();
                this.client.log(`Connection failed, retrying in ${delay/1000}s (attempt ${this.retryCount}/${this.maxRetries})...`, 'warning');
                this.client.updateStatus(`Retrying connection (${this.retryCount}/${this.maxRetries})...`, 'warning');
                
                setTimeout(() => {
                    this.connectWithRetry();
                }, delay);
            } else {
                this.handleConnectionFailure(error);
            }
        }
    }
    
    async attemptConnection() {
        this.client.updateStatus('Validating API configuration...', 'connecting');
        this.client.log('🔑 Validating API configuration...');
        
        // First, validate API key and get ephemeral token
        const tokenResponse = await this.getEphemeralToken();
        const { token } = tokenResponse;
        
        this.client.updateStatus('Requesting microphone access...', 'connecting');
        this.client.log('🎤 Requesting microphone access...');
        
        // Get user media early to catch permission issues
        const stream = await this.getUserMedia();
        
        this.client.updateStatus('Setting up WebRTC connection...', 'connecting');
        this.client.log('🔗 Setting up WebRTC peer connection...');
        
        // Setup WebRTC connection
        await this.setupWebRTCConnection(stream, token);
    }
    
    async getEphemeralToken() {
        try {
            const response = await fetch('/api/ephemeral-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                
                if (response.status === 500 && errorData.error?.includes('API key not configured')) {
                    throw new APIKeyError('OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file.');
                } else if (response.status === 401) {
                    throw new APIKeyError('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env file.');
                } else if (response.status === 429) {
                    throw new RateLimitError('OpenAI API rate limit exceeded. Please try again later.');
                } else {
                    throw new NetworkError(`Server error (${response.status}): ${errorData.error || response.statusText}`);
                }
            }
            
            return await response.json();
        } catch (error) {
            if (error instanceof APIKeyError || error instanceof RateLimitError || error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError(`Failed to connect to server: ${error.message}`);
        }
    }
    
    async getUserMedia() {
        try {
            return await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
        } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new PermissionError('Microphone access denied. Please allow microphone access and try again.');
            } else if (error.name === 'NotFoundError') {
                throw new PermissionError('No microphone found. Please connect a microphone and try again.');
            } else {
                throw new PermissionError(`Microphone access failed: ${error.message}`);
            }
        }
    }
    
    async setupWebRTCConnection(stream, token) {
        try {
            // Create RTCPeerConnection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            // Add ICE connection state monitoring
            this.peerConnection.oniceconnectionstatechange = () => {
                this.client.log(`ICE connection state: ${this.peerConnection.iceConnectionState}`);
                if (this.peerConnection.iceConnectionState === 'failed') {
                    throw new WebRTCError('WebRTC ICE connection failed. This may be due to network/firewall restrictions.');
                }
            };
            
            // Create data channel for events (must be named "oai-events" for OpenAI)
            this.dataChannel = this.peerConnection.createDataChannel('oai-events', {
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
                        temperature: 0.6
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
            
            // Add audio track to peer connection
            this.audioTrack = stream.getAudioTracks()[0];
            this.peerConnection.addTrack(this.audioTrack, stream);
            
            this.client.updateStatus('Creating WebRTC offer...', 'connecting');
            
            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.client.updateStatus('Connecting to OpenAI WebRTC...', 'connecting');
            
            // Send offer to OpenAI
            const rtcResponse = await this.sendOfferToOpenAI(offer, token);
            
            // The response should be SDP answer text
            const answerSdp = await rtcResponse.text();
            
            // Set remote description with the SDP answer
            await this.peerConnection.setRemoteDescription({
                type: 'answer',
                sdp: answerSdp
            });
            
            this.client.isConnected = true;
            this.client.updateStatus('Connected via WebRTC', 'connected');
            this.client.connectBtn.disabled = true;
            this.client.micBtn.disabled = false;
            this.client.disconnectBtn.disabled = false;
            this.client.log('✅ WebRTC connection established with OpenAI');
            this.retryCount = 0; // Reset retry count on success
            
        } catch (error) {
            throw error; // Re-throw to be handled by retry logic
        }
    }
    
    async sendOfferToOpenAI(offer, token) {
        try {
            const response = await fetch('https://api.openai.com/v1/realtime', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/sdp',
                },
                body: offer.sdp
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 401) {
                    throw new APIKeyError('Invalid OpenAI API token for WebRTC connection.');
                } else if (response.status === 429) {
                    throw new RateLimitError('OpenAI WebRTC rate limit exceeded.');
                } else if (response.status >= 500) {
                    throw new OpenAIServiceError(`OpenAI service error (${response.status}): ${errorText}`);
                } else {
                    throw new WebRTCError(`WebRTC setup failed (${response.status}): ${errorText}`);
                }
            }
            
            return response;
        } catch (error) {
            if (error instanceof APIKeyError || error instanceof RateLimitError || error instanceof OpenAIServiceError || error instanceof WebRTCError) {
                throw error;
            }
            throw new NetworkError(`Failed to establish WebRTC connection: ${error.message}`);
        }
    }
    
    shouldRetry(error) {
        // Don't retry for permanent errors
        return !(error instanceof APIKeyError || error instanceof PermissionError);
    }
    
    getRetryDelay() {
        // Exponential backoff: 1s, 2s, 4s
        return this.baseDelay * Math.pow(2, this.retryCount - 1);
    }
    
    handleConnectionFailure(error) {
        this.client.isConnected = false;
        this.client.updateStatus('Connection failed', 'error');
        this.client.connectBtn.disabled = false;
        this.client.micBtn.disabled = true;
        this.client.disconnectBtn.disabled = true;
        
        let userMessage = 'WebRTC connection failed';
        let guidance = '';
        
        if (error instanceof APIKeyError) {
            userMessage = '❌ API Key Error';
            guidance = error.message + ' Check your server configuration and restart.';
        } else if (error instanceof PermissionError) {
            userMessage = '❌ Permission Error';
            guidance = error.message;
        } else if (error instanceof RateLimitError) {
            userMessage = '❌ Rate Limited';
            guidance = error.message + ' Wait a few minutes before trying again.';
        } else if (error instanceof WebRTCError) {
            userMessage = '❌ WebRTC Setup Error';
            guidance = error.message + ' Check your network connection and firewall settings.';
        } else if (error instanceof OpenAIServiceError) {
            userMessage = '❌ OpenAI Service Error';
            guidance = error.message + ' The issue is on OpenAI\'s side. Try again later.';
        } else if (error instanceof NetworkError) {
            userMessage = '❌ Network Error';
            guidance = error.message + ' Check your internet connection.';
        } else {
            userMessage = '❌ Connection Error';
            guidance = error.message;
        }
        
        this.client.log(`${userMessage}: ${guidance}`, 'error');
        
        console.error('WebRTC connection error details:', {
            type: error.constructor.name,
            message: error.message,
            retryCount: this.retryCount,
            stack: error.stack
        });
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

// Custom Error Classes for Better Error Handling
class APIKeyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'APIKeyError';
    }
}

class PermissionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PermissionError';
    }
}

class NetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NetworkError';
    }
}

class WebRTCError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WebRTCError';
    }
}

class RateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RateLimitError';
    }
}

class OpenAIServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OpenAIServiceError';
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiModalVoiceClient();
});