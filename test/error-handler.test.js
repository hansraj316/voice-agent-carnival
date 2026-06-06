import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceErrorHandler, VoiceError, redact } from '../src/utils/error-handler.js';

describe('VoiceErrorHandler.createVoiceError', () => {
    let handler;

    beforeEach(() => {
        handler = new VoiceErrorHandler();
    });

    it('maps 401/unauthorized to AUTHENTICATION_ERROR and marks it non-retryable', () => {
        const err = handler.createVoiceError(new Error('401 unauthorized'), 'deepgram', 0);
        expect(err.type).toBe('AUTHENTICATION_ERROR');
        expect(err.isRetryable).toBe(false);
    });

    it('maps 429/rate limit to RATE_LIMIT_ERROR (retryable)', () => {
        const err = handler.createVoiceError(new Error('429 rate limit hit'), 'deepgram', 0);
        expect(err.type).toBe('RATE_LIMIT_ERROR');
        expect(err.isRetryable).toBe(true);
    });

    it('maps ECONNREFUSED/ENOTFOUND to NETWORK_ERROR', () => {
        expect(handler.createVoiceError(new Error('ECONNREFUSED'), 'p', 0).type).toBe(
            'NETWORK_ERROR'
        );
        expect(handler.createVoiceError(new Error('getaddrinfo ENOTFOUND'), 'p', 0).type).toBe(
            'NETWORK_ERROR'
        );
    });

    it('maps timeout messages to TIMEOUT', () => {
        expect(handler.createVoiceError(new Error('Operation timeout'), 'p', 0).type).toBe(
            'TIMEOUT'
        );
    });

    it('returns an existing VoiceError unchanged', () => {
        const original = new VoiceError('boom', 'CUSTOM');
        expect(handler.createVoiceError(original, 'p', 0)).toBe(original);
    });

    it('defaults to UNKNOWN_ERROR for unrecognized messages', () => {
        expect(handler.createVoiceError(new Error('weird stuff'), 'p', 0).type).toBe(
            'UNKNOWN_ERROR'
        );
    });
});

describe('VoiceErrorHandler circuit breaker', () => {
    it('opens after the failure threshold and becomes unavailable', () => {
        const handler = new VoiceErrorHandler({ circuitBreakerThreshold: 3 });
        const provider = 'deepgram';
        const err = new VoiceError('fail', 'SERVER_ERROR');

        expect(handler.isProviderAvailable(provider)).toBe(true);

        for (let i = 0; i < 3; i++) {
            handler.updateCircuitBreaker(provider, err);
        }

        const breaker = handler.circuitBreakers.get(provider);
        expect(breaker.state).toBe('OPEN');
        expect(handler.isProviderAvailable(provider)).toBe(false);
    });

    it('transitions to HALF_OPEN after the timeout elapses', () => {
        vi.useFakeTimers();
        try {
            const handler = new VoiceErrorHandler({
                circuitBreakerThreshold: 1,
                circuitBreakerTimeout: 5000
            });
            const provider = 'deepgram';
            handler.updateCircuitBreaker(provider, new VoiceError('fail', 'SERVER_ERROR'));
            expect(handler.circuitBreakers.get(provider).state).toBe('OPEN');
            expect(handler.isProviderAvailable(provider)).toBe(false);

            vi.advanceTimersByTime(5001);

            // The next availability check should flip OPEN -> HALF_OPEN and allow a try.
            expect(handler.isProviderAvailable(provider)).toBe(true);
            expect(handler.circuitBreakers.get(provider).state).toBe('HALF_OPEN');
        } finally {
            vi.useRealTimers();
        }
    });

    it('closes again after a success while HALF_OPEN', () => {
        const handler = new VoiceErrorHandler({ circuitBreakerThreshold: 1 });
        const provider = 'deepgram';
        const breaker = handler.circuitBreakers.get(provider);
        breaker.state = 'HALF_OPEN';

        handler.recordSuccess(provider, 100);
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failures).toBe(0);
    });
});

describe('redact', () => {
    it('removes api_key and Authorization while keeping other fields', () => {
        const out = redact({
            provider: 'deepgram',
            api_key: 'sk-secret',
            apiKey: 'sk-secret2',
            Authorization: 'Bearer xyz',
            nested: { 'x-api-key': 'leak', keep: 'ok' }
        });
        expect(out.provider).toBe('deepgram');
        expect(out.api_key).toBe('[REDACTED]');
        expect(out.apiKey).toBe('[REDACTED]');
        expect(out.Authorization).toBe('[REDACTED]');
        expect(out.nested['x-api-key']).toBe('[REDACTED]');
        expect(out.nested.keep).toBe('ok');
    });

    it('returns non-object values unchanged', () => {
        expect(redact('hello')).toBe('hello');
        expect(redact(42)).toBe(42);
        expect(redact(null)).toBe(null);
    });
});
