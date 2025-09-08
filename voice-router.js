/**
 * Universal Voice API Router - Open Router style for Voice APIs
 * Supports Bring Your Own Key (BYOK) for multiple voice providers
 */

import { VOICE_PROVIDERS } from './voice-providers-config.js';
import { WebSocket } from 'ws';

export class VoiceRouter {
    constructor() {
        this.providers = VOICE_PROVIDERS;
        this.activeConnections = new Map();
        this.usage = new Map(); // Track usage per provider
    }

    /**
     * Route voice request to appropriate provider
     * @param {Object} config - Request configuration
     * @param {string} config.provider - Provider name (e.g., 'openai-realtime', 'elevenlabs')
     * @param {string} config.apiKey - User's API key for the provider
     * @param {Object} config.options - Provider-specific options
     * @param {string} config.type - Request type: 'stt', 'tts', 'realtime', 'conversational'
     * @returns {Object} Provider adapter instance
     */
    async routeRequest(config) {
        const { provider, apiKey, options = {}, type } = config;

        if (!this.providers[provider]) {
            throw new Error(`Provider "${provider}" not supported. Available providers: ${Object.keys(this.providers).join(', ')}`);
        }

        if (!apiKey) {
            throw new Error(`API key required for provider "${provider}"`);
        }

        const providerConfig = this.providers[provider];

        // Validate provider supports requested type
        if (type && !providerConfig.capabilities.includes(type) && providerConfig.type !== type) {
            throw new Error(`Provider "${provider}" does not support "${type}". Supported: ${providerConfig.capabilities.join(', ')}`);
        }

        // Create appropriate adapter based on provider
        const AdapterClass = this.getAdapterClass(provider);
        const adapter = new AdapterClass(providerConfig, apiKey, options);

        // Track usage
        this.trackUsage(provider, 'request');

        return adapter;
    }

    /**
     * Get the appropriate adapter class for a provider
     */
    getAdapterClass(provider) {
        const adapterMap = {
            'openai-realtime': OpenAIRealtimeAdapter,
            'deepgram': DeepgramAdapter,
            'assemblyai': AssemblyAIAdapter,
            'whisper': WhisperAdapter,
            'elevenlabs': ElevenLabsAdapter,
            'playht': PlayHTAdapter,
            'google-stt': GoogleSTTAdapter,
            'google-tts': GoogleTTSAdapter,
            'azure-stt': AzureSTTAdapter,
            'azure-tts': AzureTTSAdapter,
            'amazon-polly': AmazonPollyAdapter,
            'murf': MurfAdapter,
            'elevenlabs-conversational': ElevenLabsConversationalAdapter,
            'ibm-watson': IBMWatsonAdapter
        };

        if (!adapterMap[provider]) {
            throw new Error(`No adapter available for provider: ${provider}`);
        }

        return adapterMap[provider];
    }

    /**
     * Track usage statistics
     */
    trackUsage(provider, action, metadata = {}) {
        if (!this.usage.has(provider)) {
            this.usage.set(provider, {
                requests: 0,
                errors: 0,
                totalLatency: 0,
                lastUsed: null
            });
        }

        const stats = this.usage.get(provider);
        
        switch (action) {
            case 'request':
                stats.requests++;
                stats.lastUsed = new Date();
                break;
            case 'error':
                stats.errors++;
                break;
            case 'latency':
                stats.totalLatency += metadata.duration;
                break;
        }

        this.usage.set(provider, stats);
    }

    /**
     * Get usage statistics
     */
    getUsageStats(provider = null) {
        if (provider) {
            return this.usage.get(provider) || null;
        }
        return Object.fromEntries(this.usage);
    }

    /**
     * List available providers with their capabilities
     */
    listProviders(type = null) {
        if (!type) {
            return this.providers;
        }

        return Object.entries(this.providers)
            .filter(([_, config]) => config.type === type || config.capabilities.includes(type))
            .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    }

    /**
     * Validate provider configuration
     */
    validateProvider(provider, apiKey, options = {}) {
        if (!this.providers[provider]) {
            return { valid: false, error: `Provider "${provider}" not found` };
        }

        if (!apiKey) {
            return { valid: false, error: 'API key is required' };
        }

        // Provider-specific validation could go here
        return { valid: true };
    }
}

/**
 * Base adapter class for voice providers
 */
class BaseAdapter {
    constructor(config, apiKey, options = {}) {
        this.config = config;
        this.apiKey = apiKey;
        this.options = options;
        this.isConnected = false;
    }

    async connect() {
        throw new Error('connect() must be implemented by adapter');
    }

    async disconnect() {
        throw new Error('disconnect() must be implemented by adapter');
    }

    async process(input) {
        throw new Error('process() must be implemented by adapter');
    }
}

/**
 * OpenAI Realtime API Adapter
 */
class OpenAIRealtimeAdapter extends BaseAdapter {
    constructor(config, apiKey, options = {}) {
        super(config, apiKey, options);
        this.websocket = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const url = `${this.config.endpoint}?model=${this.options.model || 'gpt-4o-realtime-preview-2024-12-17'}`;
            
            this.websocket = new WebSocket(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            this.websocket.on('open', () => {
                this.isConnected = true;
                // Send session configuration
                this.websocket.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: this.options.instructions || 'You are a helpful assistant.',
                        voice: this.options.voice || 'alloy',
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: { model: 'whisper-1' },
                        turn_detection: { type: 'server_vad', threshold: 0.5 },
                        temperature: this.options.temperature || 0.6,
                        max_response_output_tokens: this.options.max_tokens || 4096
                    }
                }));
                resolve();
            });

            this.websocket.on('error', reject);
        });
    }

    async disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.isConnected = false;
        }
    }

    send(message) {
        if (!this.isConnected) {
            throw new Error('Not connected to OpenAI Realtime API');
        }
        this.websocket.send(JSON.stringify(message));
    }

    onMessage(callback) {
        if (this.websocket) {
            this.websocket.on('message', (data) => {
                callback(JSON.parse(data.toString()));
            });
        }
    }
}

/**
 * ElevenLabs TTS Adapter
 */
class ElevenLabsAdapter extends BaseAdapter {
    async connect() {
        // HTTP-based API, no persistent connection needed
        this.isConnected = true;
    }

    async process(text, options = {}) {
        const voiceId = options.voice_id || 'pNInz6obpgDQGcFmaJgB'; // Default voice
        const model = options.model || 'eleven_multilingual_v2';
        
        const response = await fetch(`${this.config.endpoint}/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': this.apiKey
            },
            body: JSON.stringify({
                text,
                model_id: model,
                voice_settings: {
                    stability: options.stability || 0.5,
                    similarity_boost: options.similarity_boost || 0.8,
                    style: options.style || 0,
                    use_speaker_boost: options.speaker_boost || true
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ElevenLabs API error: ${error}`);
        }

        return await response.arrayBuffer();
    }
}

/**
 * Deepgram STT Adapter
 */
class DeepgramAdapter extends BaseAdapter {
    constructor(config, apiKey, options = {}) {
        super(config, apiKey, options);
        this.websocket = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                encoding: 'linear16',
                sample_rate: 16000,
                language: this.options.language || 'en',
                model: this.options.model || 'nova-2',
                punctuate: true,
                smart_format: true,
                interim_results: this.options.interim || true
            });

            const url = `${this.config.endpoint}?${params}`;
            
            this.websocket = new WebSocket(url, {
                headers: {
                    'Authorization': `Token ${this.apiKey}`
                }
            });

            this.websocket.on('open', () => {
                this.isConnected = true;
                resolve();
            });

            this.websocket.on('error', reject);
        });
    }

    async disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.isConnected = false;
        }
    }

    sendAudio(audioData) {
        if (!this.isConnected) {
            throw new Error('Not connected to Deepgram');
        }
        this.websocket.send(audioData);
    }

    onTranscription(callback) {
        if (this.websocket) {
            this.websocket.on('message', (data) => {
                const result = JSON.parse(data.toString());
                callback(result);
            });
        }
    }
}

/**
 * Whisper API Adapter (File-based)
 */
class WhisperAdapter extends BaseAdapter {
    async connect() {
        this.isConnected = true;
    }

    async process(audioFile, options = {}) {
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('model', options.model || 'whisper-1');
        formData.append('language', options.language || 'en');
        formData.append('response_format', options.format || 'json');

        if (options.prompt) {
            formData.append('prompt', options.prompt);
        }

        const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Whisper API error: ${error}`);
        }

        return await response.json();
    }
}

// Placeholder adapters for other providers (to be implemented)
class AssemblyAIAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('AssemblyAI adapter not yet implemented'); }
}

class PlayHTAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('PlayHT adapter not yet implemented'); }
}

class GoogleSTTAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('Google STT adapter not yet implemented'); }
}

class GoogleTTSAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('Google TTS adapter not yet implemented'); }
}

class AzureSTTAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('Azure STT adapter not yet implemented'); }
}

class AzureTTSAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('Azure TTS adapter not yet implemented'); }
}

class AmazonPollyAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('Amazon Polly adapter not yet implemented'); }
}

class MurfAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('Murf adapter not yet implemented'); }
}

class ElevenLabsConversationalAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('ElevenLabs Conversational adapter not yet implemented'); }
}

class IBMWatsonAdapter extends BaseAdapter {
    async connect() { this.isConnected = true; }
    async process(input) { throw new Error('IBM Watson adapter not yet implemented'); }
}

export default VoiceRouter;