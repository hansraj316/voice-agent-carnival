/**
 * Open Router Style Voice API Endpoints
 * Provides unified HTTP endpoints for multiple voice providers with BYOK support
 */

import VoiceRouter from './voice-router.js';
import { VOICE_PROVIDERS, PROVIDER_CATEGORIES } from './voice-providers-config.js';

export class VoiceAPIEndpoints {
    constructor(app) {
        this.app = app;
        this.voiceRouter = new VoiceRouter();
        this.setupRoutes();
    }

    setupRoutes() {
        // API Info and Discovery Endpoints
        this.app.get('/v1/voice/models', this.getModels.bind(this));
        this.app.get('/v1/voice/providers', this.getProviders.bind(this));
        this.app.get('/v1/voice/providers/:provider', this.getProviderDetails.bind(this));
        
        // Voice Processing Endpoints (OpenRouter-style)
        this.app.post('/v1/voice/transcribe', this.transcribe.bind(this));
        this.app.post('/v1/voice/synthesize', this.synthesize.bind(this));
        this.app.post('/v1/voice/chat', this.chat.bind(this));
        
        // WebSocket endpoint for real-time voice
        this.app.post('/v1/voice/realtime/session', this.createRealtimeSession.bind(this));
        
        // Usage and Analytics
        this.app.get('/v1/voice/usage', this.getUsage.bind(this));
        this.app.get('/v1/voice/usage/:provider', this.getProviderUsage.bind(this));
        
        // Provider validation
        this.app.post('/v1/voice/validate', this.validateProvider.bind(this));
    }

    /**
     * Get all available voice models across providers
     * GET /v1/voice/models
     */
    async getModels(req, res) {
        try {
            const models = [];
            
            for (const [providerId, provider] of Object.entries(VOICE_PROVIDERS)) {
                provider.models.forEach(model => {
                    models.push({
                        id: `${providerId}/${model}`,
                        object: 'model',
                        provider: providerId,
                        provider_name: provider.name,
                        model: model,
                        type: provider.type,
                        capabilities: provider.capabilities,
                        pricing: provider.pricing,
                        latency: provider.latency,
                        features: provider.features
                    });
                });
            }

            res.json({
                object: 'list',
                data: models
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get all voice providers
     * GET /v1/voice/providers
     */
    async getProviders(req, res) {
        try {
            const { type } = req.query;
            const providers = this.voiceRouter.listProviders(type);
            
            res.json({
                object: 'list',
                data: Object.entries(providers).map(([id, config]) => ({
                    id,
                    name: config.name,
                    type: config.type,
                    capabilities: config.capabilities,
                    pricing: config.pricing,
                    latency: config.latency,
                    models: config.models,
                    features: config.features
                })),
                categories: PROVIDER_CATEGORIES
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get specific provider details
     * GET /v1/voice/providers/:provider
     */
    async getProviderDetails(req, res) {
        try {
            const { provider } = req.params;
            const providerConfig = VOICE_PROVIDERS[provider];
            
            if (!providerConfig) {
                return res.status(404).json({ error: 'Provider not found' });
            }

            res.json({
                id: provider,
                ...providerConfig,
                usage_stats: this.voiceRouter.getUsageStats(provider)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Speech-to-Text endpoint (OpenRouter style)
     * POST /v1/voice/transcribe
     */
    async transcribe(req, res) {
        try {
            const { 
                provider, 
                api_key, 
                model, 
                audio_file, 
                audio_url,
                language = 'en',
                options = {} 
            } = req.body;

            if (!provider || !api_key) {
                return res.status(400).json({ 
                    error: 'Provider and api_key are required' 
                });
            }

            if (!audio_file && !audio_url) {
                return res.status(400).json({ 
                    error: 'Either audio_file or audio_url is required' 
                });
            }

            const adapter = await this.voiceRouter.routeRequest({
                provider,
                apiKey: api_key,
                type: 'stt',
                options: { model, language, ...options }
            });

            await adapter.connect();

            let result;
            if (audio_file) {
                // Handle base64 encoded audio
                const audioBuffer = Buffer.from(audio_file, 'base64');
                result = await adapter.process(audioBuffer, options);
            } else if (audio_url) {
                // Download audio from URL
                const response = await fetch(audio_url);
                const audioBuffer = await response.arrayBuffer();
                result = await adapter.process(audioBuffer, options);
            }

            await adapter.disconnect();

            res.json({
                object: 'transcription',
                provider,
                model,
                text: result.text || result.transcript || result,
                language,
                duration: result.duration,
                confidence: result.confidence,
                raw_response: result
            });

        } catch (error) {
            console.error('Transcription error:', error);
            res.status(500).json({ 
                error: error.message,
                type: 'transcription_error'
            });
        }
    }

    /**
     * Text-to-Speech endpoint (OpenRouter style)
     * POST /v1/voice/synthesize
     */
    async synthesize(req, res) {
        try {
            const { 
                provider, 
                api_key, 
                model, 
                text, 
                voice, 
                response_format = 'mp3',
                options = {} 
            } = req.body;

            if (!provider || !api_key || !text) {
                return res.status(400).json({ 
                    error: 'Provider, api_key, and text are required' 
                });
            }

            const adapter = await this.voiceRouter.routeRequest({
                provider,
                apiKey: api_key,
                type: 'tts',
                options: { model, voice, response_format, ...options }
            });

            await adapter.connect();
            const audioBuffer = await adapter.process(text, { voice, ...options });
            await adapter.disconnect();

            // Return audio as base64 or stream
            const base64Audio = Buffer.from(audioBuffer).toString('base64');

            res.json({
                object: 'audio',
                provider,
                model,
                voice,
                format: response_format,
                audio: base64Audio,
                text,
                duration_estimate: Math.ceil(text.length / 15) // Rough estimate
            });

        } catch (error) {
            console.error('Synthesis error:', error);
            res.status(500).json({ 
                error: error.message,
                type: 'synthesis_error'
            });
        }
    }

    /**
     * Conversational Voice Chat endpoint (similar to OpenAI chat completions)
     * POST /v1/voice/chat
     */
    async chat(req, res) {
        try {
            const { 
                provider, 
                api_key, 
                model, 
                messages = [],
                voice = 'alloy',
                stream = false,
                options = {} 
            } = req.body;

            if (!provider || !api_key || !messages.length) {
                return res.status(400).json({ 
                    error: 'Provider, api_key, and messages are required' 
                });
            }

            if (stream) {
                // Set up Server-Sent Events for streaming
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });
            }

            const adapter = await this.voiceRouter.routeRequest({
                provider,
                apiKey: api_key,
                type: 'conversational',
                options: { model, voice, ...options }
            });

            await adapter.connect();

            if (stream) {
                // Handle streaming response
                adapter.onMessage((message) => {
                    res.write(`data: ${JSON.stringify(message)}\\n\\n`);
                });
                
                // Send messages to provider
                messages.forEach(msg => {
                    adapter.send(msg);
                });
            } else {
                // Handle non-streaming response
                const response = await adapter.process(messages, { voice, ...options });
                
                await adapter.disconnect();

                res.json({
                    object: 'voice_chat_completion',
                    provider,
                    model,
                    choices: [{
                        index: 0,
                        message: response.message || response,
                        finish_reason: 'stop'
                    }],
                    usage: response.usage || {}
                });
            }

        } catch (error) {
            console.error('Chat error:', error);
            res.status(500).json({ 
                error: error.message,
                type: 'chat_error'
            });
        }
    }

    /**
     * Create real-time voice session
     * POST /v1/voice/realtime/session
     */
    async createRealtimeSession(req, res) {
        try {
            const { 
                provider, 
                api_key, 
                model, 
                voice = 'alloy',
                options = {} 
            } = req.body;

            if (!provider || !api_key) {
                return res.status(400).json({ 
                    error: 'Provider and api_key are required' 
                });
            }

            // Generate session configuration based on provider
            const sessionConfig = {
                provider,
                model,
                voice,
                websocket_url: this.generateWebSocketURL(provider, api_key, options),
                session_id: this.generateSessionId(),
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
                options
            };

            res.json({
                object: 'realtime_session',
                ...sessionConfig
            });

        } catch (error) {
            console.error('Session creation error:', error);
            res.status(500).json({ 
                error: error.message,
                type: 'session_error'
            });
        }
    }

    /**
     * Get usage statistics
     * GET /v1/voice/usage
     */
    async getUsage(req, res) {
        try {
            const stats = this.voiceRouter.getUsageStats();
            
            res.json({
                object: 'usage_stats',
                total_providers: Object.keys(stats).length,
                total_requests: Object.values(stats).reduce((sum, s) => sum + s.requests, 0),
                total_errors: Object.values(stats).reduce((sum, s) => sum + s.errors, 0),
                by_provider: stats
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get provider-specific usage
     * GET /v1/voice/usage/:provider
     */
    async getProviderUsage(req, res) {
        try {
            const { provider } = req.params;
            const stats = this.voiceRouter.getUsageStats(provider);
            
            if (!stats) {
                return res.status(404).json({ error: 'Provider not found or no usage data' });
            }

            res.json({
                object: 'provider_usage',
                provider,
                ...stats
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Validate provider credentials
     * POST /v1/voice/validate
     */
    async validateProvider(req, res) {
        try {
            const { provider, api_key, options = {} } = req.body;

            if (!provider || !api_key) {
                return res.status(400).json({ 
                    error: 'Provider and api_key are required' 
                });
            }

            const validation = this.voiceRouter.validateProvider(provider, api_key, options);
            
            if (!validation.valid) {
                return res.status(400).json({ 
                    valid: false, 
                    error: validation.error 
                });
            }

            // Test connection to provider
            try {
                const adapter = await this.voiceRouter.routeRequest({
                    provider,
                    apiKey: api_key,
                    options
                });
                
                await adapter.connect();
                await adapter.disconnect();

                res.json({
                    valid: true,
                    provider,
                    message: 'Provider credentials are valid and connection successful'
                });
            } catch (connectionError) {
                res.json({
                    valid: false,
                    provider,
                    error: `Connection failed: ${connectionError.message}`
                });
            }

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Helper methods
    generateWebSocketURL(provider, apiKey, options) {
        const baseURL = VOICE_PROVIDERS[provider]?.endpoint;
        if (!baseURL) return null;

        const url = new URL(baseURL);
        url.searchParams.set('api_key', apiKey);
        
        if (options.model) url.searchParams.set('model', options.model);
        if (options.voice) url.searchParams.set('voice', options.voice);
        
        return url.toString();
    }

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    }
}

export default VoiceAPIEndpoints;