import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
    notFoundHandler,
    errorHandler,
    statusForErrorType
} from '../src/middleware/error-middleware.js';
import { VoiceError } from '../src/utils/error-handler.js';

function buildApp(routeSetup) {
    const app = express();
    app.use(express.json());
    if (routeSetup) routeSetup(app);
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}

describe('statusForErrorType', () => {
    it('maps known VoiceError types to HTTP statuses', () => {
        expect(statusForErrorType('AUTHENTICATION_ERROR')).toBe(401);
        expect(statusForErrorType('AUTHORIZATION_ERROR')).toBe(403);
        expect(statusForErrorType('RATE_LIMIT_ERROR')).toBe(429);
        expect(statusForErrorType('SOMETHING_ELSE')).toBe(500);
    });
});

describe('notFoundHandler', () => {
    it('returns a JSON 404 envelope', async () => {
        const app = buildApp();
        const res = await request(app).get('/nope');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { message: 'Not Found', type: 'not_found' } });
    });
});

describe('errorHandler', () => {
    it('maps a thrown VoiceError to its status and envelope', async () => {
        const app = buildApp((a) => {
            a.get('/boom', (req, res, next) => {
                next(new VoiceError('bad key', 'AUTHENTICATION_ERROR'));
            });
        });
        const res = await request(app).get('/boom');
        expect(res.status).toBe(401);
        expect(res.body.error.type).toBe('AUTHENTICATION_ERROR');
        expect(res.body.error.message).toBe('bad key');
    });

    it('maps a generic Error to a 500 internal envelope', async () => {
        const app = buildApp((a) => {
            a.get('/oops', () => {
                throw new Error('kaboom');
            });
        });
        const res = await request(app).get('/oops');
        expect(res.status).toBe(500);
        expect(res.body.error.type).toBe('internal_error');
    });
});
