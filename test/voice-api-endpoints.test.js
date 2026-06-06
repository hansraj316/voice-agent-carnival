import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { VoiceAPIEndpoints } from '../src/routes/voice-api-endpoints.js';
import { notFoundHandler, errorHandler } from '../src/middleware/error-middleware.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    // skipInit avoids file IO + background timers during tests.
    new VoiceAPIEndpoints(app, { skipInit: true });
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}

describe('Voice API endpoints', () => {
    let app;

    beforeAll(() => {
        app = buildApp();
    });

    it('GET /v1/voice/providers returns a list with categories', async () => {
        const res = await request(app).get('/v1/voice/providers');
        expect(res.status).toBe(200);
        expect(res.body.object).toBe('list');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.categories).toBeDefined();
    });

    it('GET /v1/voice/providers?type=stt filters the list', async () => {
        const res = await request(app).get('/v1/voice/providers?type=stt');
        expect(res.status).toBe(200);
        for (const p of res.body.data) {
            const matches = p.type === 'stt' || (p.capabilities || []).includes('stt');
            expect(matches).toBe(true);
        }
    });

    it('GET /v1/voice/models returns a model list', async () => {
        const res = await request(app).get('/v1/voice/models');
        expect(res.status).toBe(200);
        expect(res.body.object).toBe('list');
        expect(res.body.data[0]).toHaveProperty('id');
        expect(res.body.data[0]).toHaveProperty('provider');
    });

    it('GET /v1/voice/providers/:provider 404s for an unknown provider', async () => {
        const res = await request(app).get('/v1/voice/providers/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.error).toBeDefined();
    });

    it('GET /v1/voice/providers/:provider returns details for a known provider', async () => {
        const res = await request(app).get('/v1/voice/providers/deepgram');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('deepgram');
        expect(res.body.name).toBeDefined();
    });

    it('POST /v1/voice/transcribe 400s when provider/api_key missing', async () => {
        const res = await request(app).post('/v1/voice/transcribe').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/i);
    });

    it('POST /v1/voice/transcribe 400s when audio is missing', async () => {
        const res = await request(app)
            .post('/v1/voice/transcribe')
            .send({ provider: 'deepgram', api_key: 'token-123' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/audio/i);
    });

    it('POST /v1/voice/synthesize 400s when text is missing', async () => {
        const res = await request(app)
            .post('/v1/voice/synthesize')
            .send({ provider: 'elevenlabs', api_key: 'token-123' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/i);
    });

    it('returns a JSON 404 envelope for unknown /v1/voice paths', async () => {
        const res = await request(app).get('/v1/voice/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { message: 'Not Found', type: 'not_found' } });
    });
});
