/**
 * Centralized Express error-handling and 404 middleware.
 *
 * Provides consistent OpenRouter-style error envelopes
 * ({ error: { message, type } }), a JSON 404 handler for unknown routes,
 * and credential-safe logging via redact().
 */

import { VoiceError, redact } from '../utils/error-handler.js';

/**
 * Map a VoiceError type to an appropriate HTTP status code.
 * @param {string} type - VoiceError type
 * @returns {number} HTTP status code
 */
export function statusForErrorType(type) {
    switch (type) {
        case 'AUTHENTICATION_ERROR':
            return 401;
        case 'AUTHORIZATION_ERROR':
            return 403;
        case 'NOT_FOUND':
            return 404;
        case 'RATE_LIMIT_ERROR':
            return 429;
        case 'TIMEOUT':
            return 504;
        case 'PROVIDER_UNAVAILABLE':
        case 'SERVER_ERROR':
        case 'NETWORK_ERROR':
            return 502;
        default:
            return 500;
    }
}

/**
 * JSON 404 handler for unknown routes. Register AFTER all routes.
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: {
            message: 'Not Found',
            type: 'not_found'
        }
    });
}

/**
 * Centralized 4-arg Express error-handling middleware. Register LAST.
 * Produces a consistent { error: { message, type } } envelope and logs
 * the failing request with credentials redacted.
 */
export function errorHandler(err, req, res, next) {
    const isVoiceError = err instanceof VoiceError;
    const type = isVoiceError ? err.type : 'internal_error';
    const status = isVoiceError ? statusForErrorType(err.type) : 500;

    // Log without leaking secrets from the request body or headers.
    console.error('❌ Request error:', {
        method: req.method,
        path: req.originalUrl,
        type,
        message: err.message,
        body: redact(req.body),
        headers: redact(req.headers)
    });

    // If headers were already sent (e.g. streaming responses), delegate.
    if (res.headersSent) {
        return next(err);
    }

    res.status(status).json({
        error: {
            message: err.message || 'Internal Server Error',
            type
        }
    });
}

export default { notFoundHandler, errorHandler, statusForErrorType };
