/**
 * Voice Router Client - Frontend JavaScript for Voice API Testing
 * Handles interactions with the Open Router-style voice API endpoints
 */

class VoiceRouterClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.providers = {};
        this.selectedProvider = null;
        this.realtimeSession = null;
        this.websocket = null;
        
        this.init();
    }

    async init() {
        await this.loadProviders();
        this.setupEventListeners();
        this.setupFileUpload();
        this.updateStatus('Ready to test voice providers');
    }

    async loadProviders() {
        try {
            const response = await fetch(`${this.baseURL}/v1/voice/providers`);
            const data = await response.json();
            
            this.providers = {};
            data.data.forEach(provider => {
                this.providers[provider.id] = provider;
            });
            
            this.populateProvidersList(data.data, data.categories);
            this.populateProviderSelect();
        } catch (error) {
            console.error('Failed to load providers:', error);
            this.updateStatus('Failed to load providers', 'error');
        }
    }

    populateProvidersList(providers, categories) {
        const container = document.getElementById('providersList');
        container.innerHTML = '';

        Object.entries(categories).forEach(([category, providerIds]) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.innerHTML = `<h4 style="margin: 15px 0 10px 0; color: #495057; font-size: 14px;">${category}</h4>`;
            container.appendChild(categoryDiv);

            providerIds.forEach(providerId => {
                const provider = providers.find(p => p.id === providerId);
                if (provider) {
                    const card = this.createProviderCard(provider);
                    container.appendChild(card);
                }
            });
        });
    }

    createProviderCard(provider) {
        const card = document.createElement('div');
        card.className = 'provider-card';
        card.dataset.providerId = provider.id;
        
        const capabilities = provider.capabilities
            .map(cap => `<span class="capability-tag">${cap}</span>`)
            .join('');

        card.innerHTML = `
            <h4>${provider.name}</h4>
            <div class="capabilities">${capabilities}</div>
            <div class="pricing">${provider.pricing}</div>
            <div style="font-size: 11px; color: #6c757d;">Latency: ${provider.latency}</div>
        `;

        card.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
            // Select this card
            card.classList.add('selected');
            this.selectProvider(provider.id);
        });

        return card;
    }

    populateProviderSelect() {
        const select = document.getElementById('selectedProvider');
        select.innerHTML = '<option value="">Select a provider...</option>';
        
        Object.values(this.providers).forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = provider.name;
            select.appendChild(option);
        });
    }

    selectProvider(providerId) {
        this.selectedProvider = this.providers[providerId];
        document.getElementById('selectedProvider').value = providerId;
        
        // Update model dropdown
        const modelSelect = document.getElementById('model');
        modelSelect.innerHTML = '<option value="">Select model...</option>';
        
        if (this.selectedProvider.models) {
            this.selectedProvider.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        }

        this.updateStatus(`Selected: ${this.selectedProvider.name}`);
    }

    setupEventListeners() {
        document.getElementById('selectedProvider').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectProvider(e.target.value);
                // Also highlight the card
                document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
                const card = document.querySelector(`[data-provider-id="${e.target.value}"]`);
                if (card) card.classList.add('selected');
            }
        });
    }

    setupFileUpload() {
        const uploadDiv = document.getElementById('audioUpload');
        const fileInput = document.getElementById('audioFile');

        uploadDiv.addEventListener('click', () => fileInput.click());

        uploadDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadDiv.classList.add('dragover');
        });

        uploadDiv.addEventListener('dragleave', () => {
            uploadDiv.classList.remove('dragover');
        });

        uploadDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadDiv.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });
    }

    handleFileSelect(file) {
        const fileName = document.getElementById('audioFileName');
        fileName.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        fileName.style.display = 'block';
        this.selectedAudioFile = file;
    }

    async validateProvider() {
        const provider = document.getElementById('selectedProvider').value;
        const apiKey = document.getElementById('apiKey').value;

        if (!provider || !apiKey) {
            this.updateStatus('Please select a provider and enter API key', 'error');
            return;
        }

        try {
            this.updateStatus('Validating provider credentials...', 'info');
            
            const response = await fetch(`${this.baseURL}/v1/voice/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, api_key: apiKey })
            });

            const result = await response.json();
            
            if (result.valid) {
                this.updateStatus('✅ Provider credentials are valid!', 'success');
            } else {
                this.updateStatus(`❌ Validation failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Validation error:', error);
            this.updateStatus(`❌ Validation error: ${error.message}`, 'error');
        }
    }

    async transcribeAudio() {
        const provider = document.getElementById('selectedProvider').value;
        const apiKey = document.getElementById('apiKey').value;
        const model = document.getElementById('model').value;
        const language = document.getElementById('language').value;
        const audioUrl = document.getElementById('audioUrl').value;

        if (!provider || !apiKey) {
            this.updateStatus('Please select provider and enter API key', 'error');
            return;
        }

        if (!this.selectedAudioFile && !audioUrl) {
            this.updateStatus('Please select audio file or provide URL', 'error');
            return;
        }

        try {
            document.getElementById('transcribeLoading').style.display = 'inline-block';
            this.updateStatus('Transcribing audio...', 'info');

            let requestBody = {
                provider,
                api_key: apiKey,
                model: model || undefined,
                language,
                options: {}
            };

            if (this.selectedAudioFile) {
                // Convert file to base64
                const base64Audio = await this.fileToBase64(this.selectedAudioFile);
                requestBody.audio_file = base64Audio;
            } else {
                requestBody.audio_url = audioUrl;
            }

            const response = await fetch(`${this.baseURL}/v1/voice/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (response.ok) {
                this.displayResponse('Transcription Result', result);
                this.updateStatus('✅ Transcription completed successfully!', 'success');
            } else {
                this.displayResponse('Error', result);
                this.updateStatus(`❌ Transcription failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Transcription error:', error);
            this.updateStatus(`❌ Transcription error: ${error.message}`, 'error');
        } finally {
            document.getElementById('transcribeLoading').style.display = 'none';
        }
    }

    async synthesizeText() {
        const provider = document.getElementById('selectedProvider').value;
        const apiKey = document.getElementById('apiKey').value;
        const model = document.getElementById('model').value;
        const text = document.getElementById('textInput').value;
        const voice = document.getElementById('voice').value;
        const format = document.getElementById('responseFormat').value;

        if (!provider || !apiKey || !text) {
            this.updateStatus('Please provide provider, API key, and text', 'error');
            return;
        }

        try {
            document.getElementById('synthesizeLoading').style.display = 'inline-block';
            this.updateStatus('Synthesizing speech...', 'info');

            const response = await fetch(`${this.baseURL}/v1/voice/synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    api_key: apiKey,
                    model: model || undefined,
                    text,
                    voice: voice || undefined,
                    response_format: format
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.displayResponse('Synthesis Result', result);
                this.playGeneratedAudio(result.audio, format);
                this.updateStatus('✅ Speech synthesis completed!', 'success');
            } else {
                this.displayResponse('Error', result);
                this.updateStatus(`❌ Synthesis failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Synthesis error:', error);
            this.updateStatus(`❌ Synthesis error: ${error.message}`, 'error');
        } finally {
            document.getElementById('synthesizeLoading').style.display = 'none';
        }
    }

    playGeneratedAudio(base64Audio, format) {
        const audioControls = document.getElementById('audioControls');
        const audioPlayer = document.getElementById('generatedAudio');
        
        const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
        const audioBlob = this.base64ToBlob(base64Audio, mimeType);
        const audioUrl = URL.createObjectURL(audioBlob);
        
        audioPlayer.src = audioUrl;
        audioControls.style.display = 'block';
        
        // Store for download
        this.generatedAudioBlob = audioBlob;
        this.generatedAudioFormat = format;
    }

    downloadAudio() {
        if (!this.generatedAudioBlob) {
            this.updateStatus('No audio to download', 'error');
            return;
        }

        const url = URL.createObjectURL(this.generatedAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-audio.${this.generatedAudioFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async startVoiceChat() {
        const provider = document.getElementById('selectedProvider').value;
        const apiKey = document.getElementById('apiKey').value;
        const model = document.getElementById('model').value;
        const messagesText = document.getElementById('chatMessages').value;
        const voice = document.getElementById('voice').value;
        const stream = document.getElementById('streamResponse').checked;

        if (!provider || !apiKey || !messagesText) {
            this.updateStatus('Please provide provider, API key, and messages', 'error');
            return;
        }

        let messages;
        try {
            messages = JSON.parse(messagesText);
        } catch (error) {
            this.updateStatus('Invalid JSON in messages field', 'error');
            return;
        }

        try {
            document.getElementById('chatLoading').style.display = 'inline-block';
            this.updateStatus('Starting voice chat...', 'info');

            const response = await fetch(`${this.baseURL}/v1/voice/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    api_key: apiKey,
                    model: model || undefined,
                    messages,
                    voice: voice || undefined,
                    stream
                })
            });

            if (stream) {
                this.handleStreamingResponse(response);
            } else {
                const result = await response.json();
                this.displayResponse('Voice Chat Result', result);
                
                if (response.ok) {
                    this.updateStatus('✅ Voice chat completed!', 'success');
                } else {
                    this.updateStatus(`❌ Voice chat failed: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Voice chat error:', error);
            this.updateStatus(`❌ Voice chat error: ${error.message}`, 'error');
        } finally {
            if (!stream) {
                document.getElementById('chatLoading').style.display = 'none';
            }
        }
    }

    async handleStreamingResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        this.updateStatus('Streaming response...', 'info');
        this.clearResponse();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            this.updateStatus('✅ Streaming completed!', 'success');
                            return;
                        }
                        
                        try {
                            const message = JSON.parse(data);
                            this.appendStreamingMessage(message);
                        } catch (e) {
                            console.log('Non-JSON streaming data:', data);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Streaming error:', error);
            this.updateStatus(`❌ Streaming error: ${error.message}`, 'error');
        } finally {
            document.getElementById('chatLoading').style.display = 'none';
        }
    }

    async connectRealtime() {
        const provider = document.getElementById('selectedProvider').value;
        const apiKey = document.getElementById('apiKey').value;
        const model = document.getElementById('model').value;
        const voice = document.getElementById('voice').value;
        const instructions = document.getElementById('instructions').value;

        if (!provider || !apiKey) {
            this.updateStatus('Please select provider and enter API key', 'error');
            return;
        }

        try {
            this.updateStatus('Creating real-time session...', 'info');

            const response = await fetch(`${this.baseURL}/v1/voice/realtime/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    api_key: apiKey,
                    model: model || undefined,
                    voice: voice || 'alloy',
                    options: { instructions }
                })
            });

            const session = await response.json();

            if (response.ok) {
                this.realtimeSession = session;
                this.connectWebSocket(session.websocket_url);
                document.getElementById('realtimeStatus').textContent = 'Connecting...';
            } else {
                this.updateStatus(`❌ Session creation failed: ${session.error}`, 'error');
            }
        } catch (error) {
            console.error('Real-time connection error:', error);
            this.updateStatus(`❌ Connection error: ${error.message}`, 'error');
        }
    }

    connectWebSocket(wsUrl) {
        if (!wsUrl) {
            this.updateStatus('No WebSocket URL provided by session', 'error');
            return;
        }

        try {
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                document.getElementById('realtimeStatus').textContent = 'Connected';
                document.getElementById('connectBtn').style.display = 'none';
                document.getElementById('disconnectBtn').style.display = 'inline-block';
                this.updateStatus('✅ Real-time connection established!', 'success');
            };

            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.appendStreamingMessage(message);
            };

            this.websocket.onclose = () => {
                document.getElementById('realtimeStatus').textContent = 'Disconnected';
                document.getElementById('connectBtn').style.display = 'inline-block';
                document.getElementById('disconnectBtn').style.display = 'none';
                this.updateStatus('Real-time connection closed', 'info');
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('❌ WebSocket error occurred', 'error');
            };

        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.updateStatus(`❌ WebSocket error: ${error.message}`, 'error');
        }
    }

    disconnectRealtime() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.realtimeSession = null;
    }

    // Utility methods
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

        // Show selected tab
        document.getElementById(`${tabName}-tab`).classList.add('active');
        event.target.classList.add('active');
    }

    updateStatus(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // You could also update a status element in the UI here
    }

    displayResponse(title, data) {
        const responseArea = document.getElementById('responseArea');
        const timestamp = new Date().toLocaleTimeString();
        const formattedData = JSON.stringify(data, null, 2);
        
        responseArea.innerHTML = `<strong>${title}</strong> (${timestamp})\\n\\n${formattedData}`;
    }

    clearResponse() {
        document.getElementById('responseArea').innerHTML = '<em>Streaming response...</em>';
    }

    appendStreamingMessage(message) {
        const responseArea = document.getElementById('responseArea');
        const formattedMessage = JSON.stringify(message, null, 2);
        responseArea.innerHTML += `\\n\\n---\\n${formattedMessage}`;
        responseArea.scrollTop = responseArea.scrollHeight;
    }
}

// Global functions for HTML onclick handlers
function switchTab(tabName) {
    client.switchTab(tabName);
}

function validateProvider() {
    client.validateProvider();
}

function transcribeAudio() {
    client.transcribeAudio();
}

function synthesizeText() {
    client.synthesizeText();
}

function startVoiceChat() {
    client.startVoiceChat();
}

function connectRealtime() {
    client.connectRealtime();
}

function disconnectRealtime() {
    client.disconnectRealtime();
}

function downloadAudio() {
    client.downloadAudio();
}

// Initialize the client when page loads
let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new VoiceRouterClient();
});