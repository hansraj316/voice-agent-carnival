/**
 * Analytics and Cost Tracking for Voice API Router
 * Tracks usage metrics, costs, and performance across all providers
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AnalyticsTracker {
    constructor(options = {}) {
        this.analyticsFile = path.join(__dirname, '../../data/voice-analytics.json');
        this.sessionStart = new Date();
        this.flushInterval = options.flushInterval || 60000; // 1 minute
        this.maxMemoryEntries = options.maxMemoryEntries || 1000;
        
        // In-memory analytics data
        this.sessions = new Map();
        this.metrics = {
            totalRequests: 0,
            totalCost: 0,
            totalDuration: 0,
            providerStats: new Map(),
            errorsByProvider: new Map(),
            costByProvider: new Map(),
            requestsByHour: new Map(),
            averageResponseTime: 0,
            peakConcurrentSessions: 0,
            currentConcurrentSessions: 0
        };

        // Cost calculation tables (per provider)
        this.costTables = {
            'openai-realtime': {
                type: 'per-minute',
                inputCost: 0.06,  // $0.06 per minute input
                outputCost: 0.24, // $0.24 per minute output
                currency: 'USD'
            },
            'deepgram': {
                type: 'per-minute',
                preRecordedCost: 0.0043, // $0.0043 per minute
                streamingCost: 0.0077,   // $0.0077 per minute
                currency: 'USD'
            },
            'assemblyai': {
                type: 'per-hour',
                asyncCost: 0.37,      // $0.37 per hour
                realtimeCost: 0.47,   // $0.47 per hour
                currency: 'USD'
            },
            'whisper': {
                type: 'per-minute',
                cost: 0.006,  // $0.006 per minute
                currency: 'USD'
            },
            'elevenlabs': {
                type: 'per-character',
                creatorCost: 0.0003,  // $0.30 per 1k characters
                proCost: 0.00024,     // $0.24 per 1k characters
                currency: 'USD'
            },
            'playht': {
                type: 'per-character',
                estimatedCost: 0.0002, // Estimated based on usage-based pricing
                currency: 'USD'
            },
            'amazon-polly': {
                type: 'per-character',
                neuralCost: 0.000004, // $4.00 per 1M characters
                currency: 'USD'
            }
        };

        this.init();
    }

    async init() {
        try {
            await this.loadAnalytics();
        } catch (error) {
            console.log('📊 Creating new analytics file...');
            await this.saveAnalytics();
        }

        // Start periodic flush to disk
        this.flushTimer = setInterval(() => {
            this.saveAnalytics().catch(console.error);
        }, this.flushInterval);

        console.log('📊 Analytics tracker initialized');
    }

    /**
     * Track the start of a voice operation
     * @param {string} sessionId - Unique session identifier
     * @param {Object} metadata - Operation metadata
     */
    startOperation(sessionId, metadata) {
        const session = {
            sessionId,
            provider: metadata.provider,
            operation: metadata.operation, // 'transcribe', 'synthesize', 'chat', 'realtime'
            model: metadata.model,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            success: null,
            cost: 0,
            usage: {
                inputTokens: 0,
                outputTokens: 0,
                characters: 0,
                minutes: 0,
                requests: 1
            },
            metadata
        };

        this.sessions.set(sessionId, session);
        this.metrics.currentConcurrentSessions++;
        this.metrics.totalRequests++;

        // Update peak concurrent sessions
        if (this.metrics.currentConcurrentSessions > this.metrics.peakConcurrentSessions) {
            this.metrics.peakConcurrentSessions = this.metrics.currentConcurrentSessions;
        }

        // Update hourly requests
        const hour = new Date().getHours();
        const hourKey = `${new Date().toDateString()}-${hour}`;
        this.metrics.requestsByHour.set(hourKey, 
            (this.metrics.requestsByHour.get(hourKey) || 0) + 1);

        return session;
    }

    /**
     * Track the completion of a voice operation
     * @param {string} sessionId - Session identifier
     * @param {Object} result - Operation result
     */
    endOperation(sessionId, result) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`Analytics: Session ${sessionId} not found`);
            return;
        }

        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;
        session.success = result.success !== false;

        // Update usage based on result
        if (result.usage) {
            session.usage = { ...session.usage, ...result.usage };
        }

        // Calculate cost
        session.cost = this.calculateCost(session);

        // Update metrics
        this.updateMetrics(session);

        // Remove from active sessions
        this.metrics.currentConcurrentSessions--;

        // Archive or remove session based on memory limits
        if (this.sessions.size > this.maxMemoryEntries) {
            this.sessions.delete(sessionId);
        }

        return session;
    }

    /**
     * Track an error in a voice operation
     * @param {string} sessionId - Session identifier
     * @param {Object} error - Error details
     */
    trackError(sessionId, error) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.success = false;
            session.error = {
                type: error.type || 'UNKNOWN_ERROR',
                message: error.message,
                timestamp: Date.now()
            };
            session.endTime = Date.now();
            session.duration = session.endTime - session.startTime;

            this.updateMetrics(session);
            this.metrics.currentConcurrentSessions--;
        }

        // Track provider errors
        const provider = session?.provider || 'unknown';
        const errorMap = this.metrics.errorsByProvider.get(provider) || new Map();
        const errorType = error.type || 'UNKNOWN_ERROR';
        errorMap.set(errorType, (errorMap.get(errorType) || 0) + 1);
        this.metrics.errorsByProvider.set(provider, errorMap);
    }

    /**
     * Calculate cost for a session
     * @param {Object} session - Session data
     * @returns {number} Cost in USD
     */
    calculateCost(session) {
        const costTable = this.costTables[session.provider];
        if (!costTable) {
            return 0; // Unknown provider
        }

        let cost = 0;
        const usage = session.usage;

        switch (costTable.type) {
            case 'per-minute':
                const minutes = Math.max(session.duration / 60000, 0.1); // Minimum 0.1 minute
                
                if (session.provider === 'openai-realtime') {
                    cost = (usage.inputTokens || 0) * costTable.inputCost / 1000000 * 60; // Convert tokens to minutes
                    cost += (usage.outputTokens || 0) * costTable.outputCost / 1000000 * 60;
                } else if (session.provider === 'deepgram') {
                    const isStreaming = session.operation === 'realtime';
                    cost = minutes * (isStreaming ? costTable.streamingCost : costTable.preRecordedCost);
                } else {
                    cost = minutes * (costTable.cost || 0);
                }
                break;

            case 'per-hour':
                const hours = Math.max(session.duration / 3600000, 0.01); // Minimum 0.01 hour
                const isRealtime = session.operation === 'realtime';
                cost = hours * (isRealtime ? costTable.realtimeCost : costTable.asyncCost);
                break;

            case 'per-character':
                const characters = usage.characters || session.metadata.textLength || 0;
                if (session.provider === 'elevenlabs') {
                    // Assume Pro tier pricing as default
                    cost = characters * costTable.proCost;
                } else {
                    cost = characters * (costTable.cost || costTable.estimatedCost || costTable.neuralCost || 0);
                }
                break;

            default:
                cost = 0;
        }

        return Math.round(cost * 100000) / 100000; // Round to 5 decimal places
    }

    /**
     * Update global metrics
     * @param {Object} session - Session data
     */
    updateMetrics(session) {
        // Update provider stats
        if (!this.metrics.providerStats.has(session.provider)) {
            this.metrics.providerStats.set(session.provider, {
                requests: 0,
                successfulRequests: 0,
                totalDuration: 0,
                totalCost: 0,
                averageResponseTime: 0,
                errorRate: 0
            });
        }

        const providerStats = this.metrics.providerStats.get(session.provider);
        providerStats.requests++;
        providerStats.totalDuration += session.duration;
        providerStats.totalCost += session.cost;
        
        if (session.success) {
            providerStats.successfulRequests++;
        }
        
        providerStats.averageResponseTime = providerStats.totalDuration / providerStats.requests;
        providerStats.errorRate = 1 - (providerStats.successfulRequests / providerStats.requests);

        // Update cost tracking
        this.metrics.costByProvider.set(session.provider, 
            (this.metrics.costByProvider.get(session.provider) || 0) + session.cost);

        // Update global metrics
        this.metrics.totalCost += session.cost;
        this.metrics.totalDuration += session.duration;
        this.metrics.averageResponseTime = this.metrics.totalDuration / this.metrics.totalRequests;
    }

    /**
     * Get analytics summary
     * @param {Object} options - Filter options
     * @returns {Object} Analytics summary
     */
    getAnalytics(options = {}) {
        const { 
            provider = null, 
            timeRange = null, 
            operation = null 
        } = options;

        let filteredSessions = Array.from(this.sessions.values());

        // Apply filters
        if (provider) {
            filteredSessions = filteredSessions.filter(s => s.provider === provider);
        }

        if (operation) {
            filteredSessions = filteredSessions.filter(s => s.operation === operation);
        }

        if (timeRange) {
            const now = Date.now();
            const cutoff = now - (timeRange * 60 * 1000); // timeRange in minutes
            filteredSessions = filteredSessions.filter(s => s.startTime >= cutoff);
        }

        // Calculate filtered metrics
        const analytics = {
            summary: {
                totalSessions: filteredSessions.length,
                successfulSessions: filteredSessions.filter(s => s.success).length,
                totalCost: filteredSessions.reduce((sum, s) => sum + s.cost, 0),
                totalDuration: filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
                averageResponseTime: 0,
                errorRate: 0,
                peakConcurrentSessions: this.metrics.peakConcurrentSessions,
                currentConcurrentSessions: this.metrics.currentConcurrentSessions
            },
            byProvider: {},
            byOperation: {},
            byHour: Object.fromEntries(this.metrics.requestsByHour),
            costBreakdown: Object.fromEntries(this.metrics.costByProvider),
            errors: this.getErrorSummary(),
            performance: this.getPerformanceMetrics(filteredSessions)
        };

        // Calculate derived metrics
        if (analytics.summary.totalSessions > 0) {
            analytics.summary.averageResponseTime = analytics.summary.totalDuration / analytics.summary.totalSessions;
            analytics.summary.errorRate = 1 - (analytics.summary.successfulSessions / analytics.summary.totalSessions);
        }

        // Group by provider
        const providerGroups = {};
        filteredSessions.forEach(session => {
            if (!providerGroups[session.provider]) {
                providerGroups[session.provider] = [];
            }
            providerGroups[session.provider].push(session);
        });

        Object.entries(providerGroups).forEach(([provider, sessions]) => {
            analytics.byProvider[provider] = this.calculateGroupMetrics(sessions);
        });

        // Group by operation
        const operationGroups = {};
        filteredSessions.forEach(session => {
            if (!operationGroups[session.operation]) {
                operationGroups[session.operation] = [];
            }
            operationGroups[session.operation].push(session);
        });

        Object.entries(operationGroups).forEach(([operation, sessions]) => {
            analytics.byOperation[operation] = this.calculateGroupMetrics(sessions);
        });

        return analytics;
    }

    /**
     * Calculate metrics for a group of sessions
     */
    calculateGroupMetrics(sessions) {
        const successful = sessions.filter(s => s.success);
        const totalCost = sessions.reduce((sum, s) => sum + s.cost, 0);
        const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        return {
            sessions: sessions.length,
            successful: successful.length,
            errorRate: 1 - (successful.length / sessions.length),
            totalCost,
            averageCost: totalCost / sessions.length,
            totalDuration,
            averageResponseTime: totalDuration / sessions.length
        };
    }

    /**
     * Get error summary
     */
    getErrorSummary() {
        const errors = {};
        for (const [provider, errorMap] of this.metrics.errorsByProvider) {
            errors[provider] = Object.fromEntries(errorMap);
        }
        return errors;
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(sessions) {
        if (sessions.length === 0) return {};

        const durations = sessions.map(s => s.duration || 0).sort((a, b) => a - b);
        const costs = sessions.map(s => s.cost).sort((a, b) => a - b);

        return {
            responseTime: {
                min: Math.min(...durations),
                max: Math.max(...durations),
                median: durations[Math.floor(durations.length / 2)],
                p95: durations[Math.floor(durations.length * 0.95)],
                p99: durations[Math.floor(durations.length * 0.99)]
            },
            cost: {
                min: Math.min(...costs),
                max: Math.max(...costs),
                median: costs[Math.floor(costs.length / 2)],
                total: costs.reduce((sum, c) => sum + c, 0)
            }
        };
    }

    /**
     * Generate cost report
     * @param {string} period - 'hour', 'day', 'week', 'month'
     * @returns {Object} Cost report
     */
    generateCostReport(period = 'day') {
        const now = new Date();
        let startTime;

        switch (period) {
            case 'hour':
                startTime = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case 'day':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'week':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        const analytics = this.getAnalytics({ 
            timeRange: (now.getTime() - startTime.getTime()) / (60 * 1000) 
        });

        return {
            period,
            startTime: startTime.toISOString(),
            endTime: now.toISOString(),
            totalCost: analytics.summary.totalCost,
            costByProvider: analytics.costBreakdown,
            topProviders: Object.entries(analytics.costByProvider)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5),
            sessions: analytics.summary.totalSessions,
            estimatedMonthlyCost: analytics.summary.totalCost * (30 * 24 * 60 * 60 * 1000) / (now.getTime() - startTime.getTime())
        };
    }

    /**
     * Load analytics from file
     */
    async loadAnalytics() {
        try {
            const data = await fs.readFile(this.analyticsFile, 'utf8');
            const parsed = JSON.parse(data);
            
            // Restore metrics
            if (parsed.metrics) {
                this.metrics = {
                    ...this.metrics,
                    ...parsed.metrics,
                    providerStats: new Map(parsed.metrics.providerStats || []),
                    errorsByProvider: new Map(parsed.metrics.errorsByProvider || []),
                    costByProvider: new Map(parsed.metrics.costByProvider || []),
                    requestsByHour: new Map(parsed.metrics.requestsByHour || [])
                };
            }

            console.log(`📊 Loaded analytics data`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('❌ Failed to load analytics:', error);
            }
            throw error;
        }
    }

    /**
     * Save analytics to file
     */
    async saveAnalytics() {
        try {
            const data = {
                version: '1.0.0',
                lastSaved: new Date().toISOString(),
                sessionStart: this.sessionStart.toISOString(),
                metrics: {
                    ...this.metrics,
                    providerStats: Array.from(this.metrics.providerStats),
                    errorsByProvider: Array.from(this.metrics.errorsByProvider),
                    costByProvider: Array.from(this.metrics.costByProvider),
                    requestsByHour: Array.from(this.metrics.requestsByHour)
                }
            };

            await fs.writeFile(this.analyticsFile, JSON.stringify(data, null, 2));
            console.log(`💾 Saved analytics data`);
        } catch (error) {
            console.error('❌ Failed to save analytics:', error);
        }
    }

    /**
     * Cleanup old data
     */
    async cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        const cutoff = Date.now() - maxAge;
        let removed = 0;

        for (const [sessionId, session] of this.sessions) {
            if (session.startTime < cutoff) {
                this.sessions.delete(sessionId);
                removed++;
            }
        }

        // Clean up hourly data older than 30 days
        const hourCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        for (const [hourKey] of this.metrics.requestsByHour) {
            const [dateStr] = hourKey.split('-');
            if (new Date(dateStr).getTime() < hourCutoff) {
                this.metrics.requestsByHour.delete(hourKey);
            }
        }

        if (removed > 0) {
            await this.saveAnalytics();
            console.log(`🧹 Cleaned up ${removed} old analytics entries`);
        }

        return { removed, remaining: this.sessions.size };
    }

    /**
     * Stop analytics tracking and cleanup
     */
    async stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        await this.saveAnalytics();
        console.log('📊 Analytics tracker stopped');
    }
}

export default AnalyticsTracker;