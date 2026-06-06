import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnalyticsTracker } from '../src/services/analytics-tracker.js';

/**
 * Unit tests for AnalyticsTracker.calculateCost across each pricing model.
 * calculateCost is a pure function of the passed session object, so we build
 * minimal session objects rather than running full operation lifecycles.
 */
describe('AnalyticsTracker.calculateCost', () => {
    let tracker;

    beforeEach(() => {
        tracker = new AnalyticsTracker();
        // Stop the periodic flush timer started by init() so tests stay isolated.
        if (tracker.flushTimer) clearInterval(tracker.flushTimer);
    });

    afterEach(() => {
        if (tracker.flushTimer) clearInterval(tracker.flushTimer);
    });

    const baseSession = (overrides = {}) => ({
        provider: 'unknown',
        operation: 'transcribe',
        duration: 60000, // 1 minute
        usage: { inputTokens: 0, outputTokens: 0, characters: 0, minutes: 0 },
        metadata: {},
        ...overrides
    });

    it('returns 0 for an unknown provider', () => {
        const cost = tracker.calculateCost(baseSession({ provider: 'does-not-exist' }));
        expect(cost).toBe(0);
    });

    it('computes openai-realtime cost from input/output tokens', () => {
        const session = baseSession({
            provider: 'openai-realtime',
            operation: 'realtime',
            duration: 60000,
            usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 }
        });
        // input: 1e6 tokens * 0.06 / 1e6 * 60 = 3.6
        // output: 1e6 tokens * 0.24 / 1e6 * 60 = 14.4 => total 18.0
        expect(tracker.calculateCost(session)).toBeCloseTo(18.0, 5);
    });

    it('uses streaming rate for deepgram realtime and pre-recorded otherwise', () => {
        const streaming = tracker.calculateCost(
            baseSession({ provider: 'deepgram', operation: 'realtime', duration: 60000 })
        );
        const preRecorded = tracker.calculateCost(
            baseSession({ provider: 'deepgram', operation: 'transcribe', duration: 60000 })
        );
        expect(streaming).toBeCloseTo(0.0077, 5);
        expect(preRecorded).toBeCloseTo(0.0043, 5);
        expect(streaming).toBeGreaterThan(preRecorded);
    });

    it('applies the 0.1-minute floor for short per-minute operations', () => {
        // 600ms = 0.01 min, but floor is 0.1 min.
        const cost = tracker.calculateCost(
            baseSession({ provider: 'deepgram', operation: 'transcribe', duration: 600 })
        );
        expect(cost).toBeCloseTo(0.1 * 0.0043, 5);
    });

    it('charges elevenlabs per character at the pro rate', () => {
        const cost = tracker.calculateCost(
            baseSession({
                provider: 'elevenlabs',
                operation: 'synthesize',
                usage: { characters: 1000 }
            })
        );
        // 1000 chars * 0.00024 = 0.24
        expect(cost).toBeCloseTo(0.24, 5);
    });

    it('falls back to metadata.textLength for per-character providers when usage absent', () => {
        const cost = tracker.calculateCost(
            baseSession({
                provider: 'amazon-polly',
                operation: 'synthesize',
                usage: {},
                metadata: { textLength: 1_000_000 }
            })
        );
        // 1e6 chars * 0.000004 = 4.0
        expect(cost).toBeCloseTo(4.0, 5);
    });

    it('computes assemblyai per-hour cost with a 0.01-hour floor', () => {
        const realtime = tracker.calculateCost(
            baseSession({ provider: 'assemblyai', operation: 'realtime', duration: 3_600_000 })
        );
        const async = tracker.calculateCost(
            baseSession({ provider: 'assemblyai', operation: 'transcribe', duration: 3_600_000 })
        );
        expect(realtime).toBeCloseTo(0.47, 5);
        expect(async).toBeCloseTo(0.37, 5);
    });
});
