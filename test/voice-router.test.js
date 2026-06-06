import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceRouter } from '../src/routes/voice-router.js';

describe('VoiceRouter.listProviders', () => {
    let router;

    beforeEach(() => {
        router = new VoiceRouter();
    });

    it('returns all providers when no type filter is given', () => {
        const all = router.listProviders();
        expect(Object.keys(all).length).toBeGreaterThan(0);
        expect(all['openai-realtime']).toBeDefined();
    });

    it('filters providers by type', () => {
        const stt = router.listProviders('stt');
        for (const config of Object.values(stt)) {
            const matches = config.type === 'stt' || config.capabilities.includes('stt');
            expect(matches).toBe(true);
        }
        // A known TTS-only provider should not appear under stt.
        expect(stt['elevenlabs']).toBeUndefined();
    });
});

describe('VoiceRouter.validateProvider', () => {
    let router;

    beforeEach(() => {
        router = new VoiceRouter();
    });

    it('rejects an unknown provider', () => {
        const result = router.validateProvider('nope', 'key');
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });

    it('rejects when the API key is missing', () => {
        const result = router.validateProvider('deepgram', '');
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/api key is required/i);
    });

    it('accepts a known provider with an API key', () => {
        const result = router.validateProvider('deepgram', 'token-123');
        expect(result.valid).toBe(true);
    });
});

describe('VoiceRouter.routeRequest', () => {
    let router;

    beforeEach(() => {
        router = new VoiceRouter();
    });

    it('throws for an unsupported provider', async () => {
        await expect(router.routeRequest({ provider: 'unsupported', apiKey: 'k' })).rejects.toThrow(
            /not supported/i
        );
    });

    it('throws when no API key is supplied', async () => {
        await expect(router.routeRequest({ provider: 'deepgram' })).rejects.toThrow(
            /api key required/i
        );
    });
});
