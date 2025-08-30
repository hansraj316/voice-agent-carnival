class VoiceEchoClient {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.mediaRecorder = null;
        this.stream = null;
        this.isConnected = false;
        this.isListening = false;
        
        this.initializeElements();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.statusEl = document.getElementById('status');
        this.connectBtn = document.getElementById('connectBtn');
        this.micBtn = document.getElementById('micBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.logEl = document.getElementById('log');
    }
    
    setupEventListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.micBtn.addEventListener('click', () => this.toggleListening());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
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
        try {
            this.log('Connecting to server...');
            this.ws = new WebSocket('ws://localhost:3000');
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.updateStatus('Connected', 'connected');
                this.connectBtn.disabled = true;
                this.micBtn.disabled = false;
                this.disconnectBtn.disabled = false;
                this.log('Connected successfully');
            };
            
            this.ws.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateStatus('Disconnected');
                this.connectBtn.disabled = false;
                this.micBtn.disabled = true;
                this.disconnectBtn.disabled = true;
                this.log('Connection closed');
                this.stopListening();
            };
            
            this.ws.onerror = (error) => {
                this.log(`WebSocket error: ${error.message}`, 'error');
            };
            
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
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
            
            // Create audio processing nodes
            const source = this.audioContext.createMediaStreamSource(this.stream);
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (event) => {
                if (this.isListening && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const inputBuffer = event.inputBuffer;
                    const channelData = inputBuffer.getChannelData(0);
                    
                    // Convert Float32Array to PCM16
                    const pcm16 = this.floatTo16BitPCM(channelData);
                    
                    // Send audio data to server
                    this.ws.send(JSON.stringify({
                        type: 'audio_input',
                        data: Array.from(pcm16)
                    }));
                }
            };
            
            source.connect(processor);
            processor.connect(this.audioContext.destination);
            
            this.isListening = true;
            this.updateStatus('Listening...', 'listening');
            this.micBtn.classList.add('listening');
            this.micBtn.textContent = '🔴';
            this.log('Started listening');
            
        } catch (error) {
            this.log(`Microphone access failed: ${error.message}`, 'error');
        }
    }
    
    stopListening() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.isListening = false;
        this.updateStatus('Connected', 'connected');
        this.micBtn.classList.remove('listening');
        this.micBtn.textContent = '🎤';
        this.log('Stopped listening');
    }
    
    handleServerMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'audio_output':
                    this.playAudio(message.data);
                    break;
                case 'status':
                    this.log(`Server: ${message.message}`);
                    break;
                case 'error':
                    this.log(`Server error: ${message.message}`, 'error');
                    break;
                default:
                    this.log(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            this.log(`Failed to parse server message: ${error.message}`, 'error');
        }
    }
    
    async playAudio(audioData) {
        try {
            this.updateStatus('Playing audio...', 'speaking');
            
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

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VoiceEchoClient();
});