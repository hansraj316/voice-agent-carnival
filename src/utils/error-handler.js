/**
 * Error Handler and Fallback System for Voice API Router
 * Provides comprehensive error handling, retry logic, and fallback mechanisms
 */

export class VoiceErrorHandler {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.fallbackProviders = options.fallbackProviders || [];
        this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
        this.circuitBreakerTimeout = options.circuitBreakerTimeout || 30000;
        
        // Circuit breaker state per provider
        this.circuitBreakers = new Map();
        
        // Error statistics
        this.errorStats = new Map();
        
        this.initializeCircuitBreakers();
    }

    initializeCircuitBreakers() {
        // Initialize circuit breaker for each provider
        const providers = [
            'openai-realtime', 'deepgram', 'assemblyai', 'whisper',
            'elevenlabs', 'playht', 'google-stt', 'google-tts',
            'azure-stt', 'azure-tts', 'amazon-polly', 'murf',
            'elevenlabs-conversational', 'ibm-watson'
        ];

        providers.forEach(provider => {
            this.circuitBreakers.set(provider, {
                state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
                failures: 0,
                lastFailureTime: null,
                nextAttemptTime: null
            });

            this.errorStats.set(provider, {
                totalRequests: 0,
                totalErrors: 0,
                errorRate: 0,
                lastError: null,
                errorTypes: {},
                avgResponseTime: 0
            });
        });
    }

    /**
     * Execute request with error handling and fallback
     * @param {Function} operation - The operation to execute
     * @param {Object} config - Configuration for error handling
     * @returns {Promise} Result or throws error
     */
    async executeWithFallback(operation, config = {}) {
        const {
            provider,
            fallbackProviders = [],
            retries = this.maxRetries,
            timeout = 30000
        } = config;

        const startTime = Date.now();
        let lastError = null;
        let attempt = 0;

        // Check circuit breaker
        if (!this.isProviderAvailable(provider)) {
            throw new VoiceError(
                `Provider ${provider} is currently unavailable (circuit breaker open)`,
                'PROVIDER_UNAVAILABLE',
                { provider, circuitBreaker: true }
            );
        }

        // Primary provider attempts
        for (attempt = 0; attempt <= retries; attempt++) {
            try {
                this.recordRequest(provider);
                
                const result = await this.executeWithTimeout(operation, timeout);
                
                // Success - reset circuit breaker
                this.recordSuccess(provider, Date.now() - startTime);
                return result;

            } catch (error) {
                lastError = this.createVoiceError(error, provider, attempt);
                this.recordError(provider, lastError, Date.now() - startTime);

                // Check if we should trigger circuit breaker
                this.updateCircuitBreaker(provider, lastError);

                // If this is not the last attempt, wait before retry
                if (attempt < retries) {
                    await this.delay(this.calculateRetryDelay(attempt));
                }

                // If provider is now unavailable, break out of retry loop
                if (!this.isProviderAvailable(provider)) {
                    break;
                }
            }
        }

        // Try fallback providers
        for (const fallbackProvider of fallbackProviders) {
            if (!this.isProviderAvailable(fallbackProvider)) {
                continue;
            }

            try {
                console.log(`🔄 Falling back to provider: ${fallbackProvider}`);
                
                this.recordRequest(fallbackProvider);
                const result = await this.executeWithTimeout(operation, timeout);
                
                this.recordSuccess(fallbackProvider, Date.now() - startTime);
                return result;

            } catch (error) {
                const fallbackError = this.createVoiceError(error, fallbackProvider, 0);
                this.recordError(fallbackProvider, fallbackError, Date.now() - startTime);
                this.updateCircuitBreaker(fallbackProvider, fallbackError);
                
                console.log(`❌ Fallback provider ${fallbackProvider} also failed:`, error.message);
            }
        }

        // All providers failed
        throw new VoiceError(
            `All providers failed. Last error: ${lastError.message}`,
            'ALL_PROVIDERS_FAILED',
            {
                provider,
                fallbackProviders,
                attempts: attempt + 1,
                lastError: lastError.toJSON()
            }
        );
    }

    /**
     * Execute operation with timeout
     */
    async executeWithTimeout(operation, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new VoiceError('Operation timed out', 'TIMEOUT', { timeout }));
            }, timeout);

            Promise.resolve(operation())
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Check if provider is available (circuit breaker check)
     */
    isProviderAvailable(provider) {
        const breaker = this.circuitBreakers.get(provider);
        if (!breaker) return true;

        switch (breaker.state) {
            case 'CLOSED':
                return true;
            
            case 'OPEN':
                // Check if we should try half-open
                if (Date.now() >= breaker.nextAttemptTime) {
                    breaker.state = 'HALF_OPEN';
                    return true;
                }
                return false;
            
            case 'HALF_OPEN':
                return true;
            
            default:
                return true;
        }
    }

    /**
     * Update circuit breaker state based on error
     */
    updateCircuitBreaker(provider, error) {
        const breaker = this.circuitBreakers.get(provider);
        if (!breaker) return;

        breaker.failures++;
        breaker.lastFailureTime = Date.now();

        // Check if we should open the circuit
        if (breaker.failures >= this.circuitBreakerThreshold && breaker.state === 'CLOSED') {
            breaker.state = 'OPEN';
            breaker.nextAttemptTime = Date.now() + this.circuitBreakerTimeout;
            
            console.log(`🚨 Circuit breaker OPENED for provider: ${provider} (${breaker.failures} failures)`);
        } else if (breaker.state === 'HALF_OPEN') {
            // Half-open failed, go back to open
            breaker.state = 'OPEN';
            breaker.nextAttemptTime = Date.now() + this.circuitBreakerTimeout;
            
            console.log(`🚨 Circuit breaker back to OPEN for provider: ${provider}`);
        }
    }

    /**
     * Record successful operation
     */
    recordSuccess(provider, responseTime) {
        const breaker = this.circuitBreakers.get(provider);
        if (breaker) {
            breaker.failures = 0;
            
            if (breaker.state === 'HALF_OPEN') {
                breaker.state = 'CLOSED';
                console.log(`✅ Circuit breaker CLOSED for provider: ${provider}`);
            }
        }

        const stats = this.errorStats.get(provider);
        if (stats) {
            stats.totalRequests++;
            stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2;
            stats.errorRate = stats.totalErrors / stats.totalRequests;
        }
    }

    /**
     * Record request attempt
     */
    recordRequest(provider) {
        const stats = this.errorStats.get(provider);
        if (stats) {
            stats.totalRequests++;
        }
    }

    /**
     * Record error
     */
    recordError(provider, error, responseTime) {
        const stats = this.errorStats.get(provider);
        if (stats) {
            stats.totalErrors++;
            stats.lastError = {
                message: error.message,
                type: error.type,
                timestamp: new Date().toISOString()
            };
            stats.errorRate = stats.totalErrors / stats.totalRequests;
            
            // Track error types
            const errorType = error.type || 'UNKNOWN';
            stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
        }
    }

    /**
     * Create standardized voice error
     */
    createVoiceError(error, provider, attempt) {
        if (error instanceof VoiceError) {
            return error;
        }

        let type = 'UNKNOWN_ERROR';
        let isRetryable = true;

        // Categorize errors
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            type = 'TIMEOUT';
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
            type = 'AUTHENTICATION_ERROR';
            isRetryable = false;
        } else if (error.message.includes('403') || error.message.includes('forbidden')) {
            type = 'AUTHORIZATION_ERROR';
            isRetryable = false;
        } else if (error.message.includes('404') || error.message.includes('not found')) {
            type = 'NOT_FOUND';
            isRetryable = false;
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            type = 'RATE_LIMIT_ERROR';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            type = 'SERVER_ERROR';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            type = 'NETWORK_ERROR';
        } else if (error.message.includes('JSON') || error.message.includes('parse')) {
            type = 'PARSE_ERROR';
        }

        return new VoiceError(error.message, type, {
            provider,
            attempt,
            isRetryable,
            originalError: error.name || 'Error'
        });
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(attempt) {
        const baseDelay = this.retryDelay;
        const maxDelay = 30000; // 30 seconds max
        
        // Exponential backoff with jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        
        return Math.min(exponentialDelay + jitter, maxDelay);
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get error statistics
     */
    getErrorStats(provider = null) {
        if (provider) {
            return {
                provider,
                stats: this.errorStats.get(provider),
                circuitBreaker: this.circuitBreakers.get(provider)
            };
        }

        const allStats = {};
        for (const [provider, stats] of this.errorStats) {
            allStats[provider] = {
                stats,
                circuitBreaker: this.circuitBreakers.get(provider)
            };
        }

        return allStats;
    }

    /**
     * Reset circuit breaker for a provider
     */
    resetCircuitBreaker(provider) {
        const breaker = this.circuitBreakers.get(provider);
        if (breaker) {
            breaker.state = 'CLOSED';
            breaker.failures = 0;
            breaker.lastFailureTime = null;
            breaker.nextAttemptTime = null;
            
            console.log(`🔄 Circuit breaker manually reset for provider: ${provider}`);
        }
    }

    /**
     * Get system health status
     */
    getSystemHealth() {
        const health = {
            status: 'healthy',
            providers: {},
            totalRequests: 0,
            totalErrors: 0,
            globalErrorRate: 0
        };

        let totalRequests = 0;
        let totalErrors = 0;

        for (const [provider, stats] of this.errorStats) {
            const breaker = this.circuitBreakers.get(provider);
            
            let providerStatus = 'healthy';
            if (breaker.state === 'OPEN') {
                providerStatus = 'down';
            } else if (breaker.state === 'HALF_OPEN') {
                providerStatus = 'recovering';
            } else if (stats.errorRate > 0.5) {
                providerStatus = 'degraded';
            }

            health.providers[provider] = {
                status: providerStatus,
                errorRate: stats.errorRate,
                circuitBreakerState: breaker.state,
                failures: breaker.failures,
                lastError: stats.lastError
            };

            totalRequests += stats.totalRequests;
            totalErrors += stats.totalErrors;
        }

        health.totalRequests = totalRequests;
        health.totalErrors = totalErrors;
        health.globalErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

        // Determine overall system status
        const downProviders = Object.values(health.providers).filter(p => p.status === 'down').length;
        const degradedProviders = Object.values(health.providers).filter(p => p.status === 'degraded').length;

        if (downProviders > Object.keys(health.providers).length / 2) {
            health.status = 'critical';
        } else if (downProviders > 0 || degradedProviders > Object.keys(health.providers).length / 3) {
            health.status = 'degraded';
        }

        return health;
    }
}

/**
 * Custom Voice Error class
 */
export class VoiceError extends Error {
    constructor(message, type = 'UNKNOWN_ERROR', metadata = {}) {
        super(message);
        this.name = 'VoiceError';
        this.type = type;
        this.metadata = metadata;
        this.timestamp = new Date().toISOString();
        this.isRetryable = metadata.isRetryable !== false;
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            metadata: this.metadata,
            timestamp: this.timestamp,
            isRetryable: this.isRetryable
        };
    }
}

export default VoiceErrorHandler;